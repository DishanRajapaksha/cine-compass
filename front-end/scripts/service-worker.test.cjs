const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/service-worker.js'), 'utf8');

function worker(fetch, caches) {
  const handlers = {};
  vm.runInNewContext(source, {
    URL, Response, fetch, caches,
    self: { location: { origin: 'https://cinecompass.test' }, clients: { claim: async () => {} }, addEventListener: (type, handler) => { handlers[type] = handler; } },
  });
  return handlers;
}

function dispatch(handler, pathname, options = {}) {
  let response;
  handler({ request: { url: `https://cinecompass.test${pathname}`, method: 'GET', mode: 'cors', ...options }, respondWith: value => { response = value; } });
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
  const handlers = worker(undefined, { keys: async () => ['cinecompass-pwa-v0', 'cinecompass-pwa-v1', 'other-app'], delete: async key => removed.push(key) });
  let done;
  handlers.activate({ waitUntil: promise => { done = promise; } });
  await done;
  assert.deepEqual(removed, ['cinecompass-pwa-v0']);
});

test('unavailable cache storage does not break online assets', async () => {
  const response = new Response('JavaScript');
  const handlers = worker(async () => response, { open: async () => { throw new Error('Storage denied'); } });
  assert.equal(await dispatch(handlers.fetch, '/static/js/main.1234abcd.js'), response);
});
