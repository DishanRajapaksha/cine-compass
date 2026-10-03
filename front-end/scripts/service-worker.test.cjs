const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/service-worker.js'), 'utf8');

function worker(fetch, caches) {
  const handlers = {};
  vm.runInNewContext(source, {
    URL, Request, Response, fetch, caches,
    self: { location: { origin: 'https://cinecompass.test' }, clients: { claim: async () => {} }, addEventListener: (type, handler) => { handlers[type] = handler; } },
  });
  return handlers;
}

function dispatch(handler, pathname, options = {}) {
  let response;
  const request = new Request(options.url || `https://cinecompass.test${pathname}`, { method: options.method || 'GET' });
  Object.defineProperty(request, 'mode', { value: options.mode || 'cors' });
  Object.defineProperty(request, 'destination', { value: options.destination || '' });
  handler({ request, respondWith: value => { response = value; } });
  return response;
}

test('account APIs, mutations and third-party data bypass the worker', () => {
  const fail = () => { throw new Error('Private requests must bypass caching'); };
  const handlers = worker(fail, { open: fail });
  for (const pathname of ['/api/auth/me', '/api/auth/csrf', '/api/settings', '/api/passkeys/options']) {
    assert.equal(dispatch(handlers.fetch, pathname), undefined);
  }
  assert.equal(dispatch(handlers.fetch, '/', { method: 'POST' }), undefined);
  assert.equal(dispatch(handlers.fetch, '/', { url: 'https://api.cineville.nl/events/search' }), undefined);
  assert.equal(dispatch(handlers.fetch, '/', { url: 'https://www.omdbapi.com/' }), undefined);
});

test('offline navigation returns the public reconnect page', async () => {
  const offline = new Response('Reconnect');
  const handlers = worker(async (_request, options) => { assert.equal(options.cache, 'no-store'); throw new TypeError('offline'); }, { open: async () => ({ match: async key => { assert.equal(key, '/offline.html'); return offline; } }) });
  assert.equal(await dispatch(handlers.fetch, '/', { mode: 'navigate' }), offline);
});

test('server errors remain visible instead of being replaced with an offline page', async () => {
  const error = new Response('Server unavailable', { status: 503 });
  const handlers = worker(async () => error, { open: () => { throw new Error('Must not fall back on HTTP errors'); } });
  assert.equal(await dispatch(handlers.fetch, '/', { mode: 'navigate' }), error);
});

test('activation removes only old CineCompass caches', async () => {
  const removed = [];
  const handlers = worker(undefined, { keys: async () => ['cinecompass-pwa-v1', 'cinecompass-pwa-v2', 'cinecompass-posters-v1', 'other-app'], delete: async key => removed.push(key) });
  let done;
  handlers.activate({ waitUntil: promise => { done = promise; } });
  await done;
  assert.deepEqual(removed, ['cinecompass-pwa-v1']);
});

test('unavailable cache storage does not break online assets', async () => {
  const response = new Response('JavaScript');
  const handlers = worker(async () => response, { open: async () => { throw new Error('Storage denied'); } });
  assert.equal(await dispatch(handlers.fetch, '/static/js/main.1234abcd.js'), response);
});

const posterUrl = 'https://culturekit-assets.imgix.net/1/assets/film.jpg';
const posterOptions = { url: posterUrl, destination: 'image', mode: 'no-cors' };
function posterStorage() {
  const entries = new Map();
  const cache = {
    match: async request => entries.get(request.url)?.clone(),
    put: async (request, response) => { entries.set(request.url, response); },
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async request => entries.delete(request.url),
  };
  return { entries, caches: { open: async name => { assert.equal(name, 'cinecompass-posters-v1'); return cache; } } };
}
function artwork() { return new Response('poster bytes', { headers: { 'content-type': 'image/jpeg' } }); }

test('posters persist across worker restarts without another network request', async () => {
  const storage = posterStorage();
  let downloads = 0;
  const network = async request => {
    downloads++;
    assert.equal(request.mode, 'cors');
    assert.equal(request.credentials, 'omit');
    return artwork();
  };
  const first = worker(network, storage.caches);
  assert.equal(await (await dispatch(first.fetch, '/', posterOptions)).text(), 'poster bytes');
  const restarted = worker(network, storage.caches);
  assert.equal(await (await dispatch(restarted.fetch, '/', posterOptions)).text(), 'poster bytes');
  assert.equal(downloads, 1);
});

test('simultaneous poster requests share one download with independent bodies', async () => {
  const storage = posterStorage();
  let downloads = 0;
  const handlers = worker(async () => { downloads++; return artwork(); }, storage.caches);
  const responses = await Promise.all(Array.from({ length: 4 }, () => dispatch(handlers.fetch, '/', posterOptions)));
  assert.deepEqual(await Promise.all(responses.map(response => response.text())), Array(4).fill('poster bytes'));
  assert.equal(downloads, 1);
});

test('poster cache removes oldest entries at 100 and changed URLs download afresh', async () => {
  const storage = posterStorage();
  const handlers = worker(async () => artwork(), storage.caches);
  for (let i = 0; i < 101; i++) await dispatch(handlers.fetch, '/', { ...posterOptions, url: `${posterUrl}?v=${i}` });
  assert.equal(storage.entries.size, 100);
  assert.equal(storage.entries.has(`${posterUrl}?v=0`), false);
  assert.equal(storage.entries.has(`${posterUrl}?v=100`), true);
});

test('failed and non-image poster responses are not cached and can be retried', async () => {
  const storage = posterStorage();
  const outcomes = [new Response('missing', { status: 404 }), new Response('HTML', { headers: { 'content-type': 'text/html' } }), artwork()];
  const handlers = worker(async () => outcomes.shift(), storage.caches);
  await dispatch(handlers.fetch, '/', posterOptions);
  assert.equal(storage.entries.size, 0);
  await dispatch(handlers.fetch, '/', posterOptions);
  assert.equal(storage.entries.size, 0);
  await dispatch(handlers.fetch, '/', posterOptions);
  assert.equal(storage.entries.size, 1);
});

test('poster downloads work when storage is unavailable', async () => {
  const handlers = worker(async () => artwork(), { open: async () => { throw new Error('Storage denied'); } });
  assert.equal(await (await dispatch(handlers.fetch, '/', posterOptions)).text(), 'poster bytes');
});

test('network failures clear pending requests for retry', async () => {
  const storage = posterStorage();
  let attempts = 0;
  const handlers = worker(async () => { if (++attempts === 1) throw new TypeError('offline'); return artwork(); }, storage.caches);
  await assert.rejects(dispatch(handlers.fetch, '/', posterOptions), /offline/);
  assert.equal(await (await dispatch(handlers.fetch, '/', posterOptions)).text(), 'poster bytes');
});

test('only public CDN asset images are intercepted', () => {
  const fail = () => { throw new Error('Must bypass caching'); };
  const handlers = worker(fail, { open: fail });
  for (const options of [
    { ...posterOptions, destination: '' },
    { ...posterOptions, url: 'https://culturekit-assets.imgix.net/private/account' },
    { ...posterOptions, url: 'https://example.com/1/assets/film.jpg' },
    { ...posterOptions, url: 'https://cinecompass.test/api/account/avatar' },
    { ...posterOptions, method: 'POST' },
  ]) assert.equal(dispatch(handlers.fetch, '/', options), undefined);
});
