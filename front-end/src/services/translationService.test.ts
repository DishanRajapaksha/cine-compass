import { translateDescription, translationChunks } from './translationService';

const success = (text: string) => ({ok: true, json: async () => ({responseStatus: 200, responseData: {translatedText: text}})});
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('splits long Unicode descriptions within the byte limit without losing text', () => {
  const description = `${'Een café met 🎬. '.repeat(80)}${'é'.repeat(600)}`;
  const chunks = translationChunks(description);
  expect(chunks.join('')).toBe(description);
  expect(chunks.length).toBeGreaterThan(1);
  chunks.forEach(chunk => expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(500));
});

test('translates all chunks, decodes entities, and caches only the complete result', async () => {
  const description = 'Een langere beschrijving. '.repeat(30);
  const chunks = translationChunks(description);
  const fetchMock = jest.fn().mockResolvedValue(success('A film &amp; a story.'));
  global.fetch = fetchMock;
  const controller = new AbortController();
  const translated = await translateDescription(description, controller.signal);
  expect(translated).toBe(chunks.map(() => 'A film & a story.').join(' '));
  expect(fetchMock).toHaveBeenCalledTimes(chunks.length);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get('q')).toBe(chunks[0]);
  expect(url.searchParams.get('langpair')).toBe('nl|en');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({credentials: 'omit', referrerPolicy: 'no-referrer'});
  expect(await translateDescription(description, controller.signal)).toBe(translated);
  expect(fetchMock).toHaveBeenCalledTimes(chunks.length);
});

test('quota errors remain retryable and are never presented as a translation', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ok: true, json: async () => ({quotaFinished: true, responseStatus: 403, responseData: {translatedText: 'LIMIT REACHED'}})}).mockResolvedValueOnce(success('Another day.'));
  const signal = new AbortController().signal;
  await expect(translateDescription('Nog een dag.', signal)).rejects.toThrow('daily translation limit');
  await expect(translateDescription('Nog een dag.', signal)).resolves.toBe('Another day.');
});

test.each([
  {ok: false},
  {ok: true, json: async () => ({responseStatus: 400, responseData: {translatedText: 'INVALID LANGUAGE'}})},
  {ok: true, json: async () => ({responseStatus: 200, responseData: {translatedText: ''}})}
])('rejects HTTP and malformed provider responses', async response => {
  global.fetch = jest.fn().mockResolvedValue(response);
  await expect(translateDescription('Een fout.', new AbortController().signal)).rejects.toThrow('unavailable');
});

test('times out slow requests with a readable retry message', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const result = translateDescription('Een trage film.', new AbortController().signal);
  const assertion = expect(result).rejects.toThrow('took too long');
  jest.advanceTimersByTime(15000);
  await assertion;
});
