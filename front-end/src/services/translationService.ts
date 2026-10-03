const cache = new Map<string, string>();

// MyMemory accepts at most 500 UTF-8 bytes per request. Prefer word boundaries
// while retaining every character, including long words and multibyte text.
export function translationChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining) {
    let bytes = 0;
    let end = 0;
    let wordEnd = 0;
    for (const character of remaining) {
      const size = encodeURIComponent(character).replace(/%[\dA-F]{2}/g, 'x').length;
      if (bytes + size > 500) break;
      bytes += size;
      end += character.length;
      if (/\s/.test(character)) wordEnd = end;
    }
    const cut = end < remaining.length && wordEnd ? wordEnd : end;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  return chunks;
}

export async function translateDescription(text: string, signal: AbortSignal): Promise<string> {
  const original = text.trim();
  const cached = cache.get(original);
  if (cached) return cached;
  const translated: string[] = [];
  for (const chunk of translationChunks(original)) {
    const params = new URLSearchParams({q: chunk, langpair: 'nl|en'});
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, {once: true});
    if (signal.aborted) controller.abort();
    const timeout = setTimeout(cancel, 15000);
    try {
      const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
        credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
      });
      if (!response.ok) throw new Error('Translation is unavailable right now. Please try again.');
      const result = await response.json();
      if (result.quotaFinished || Number(result.responseStatus) === 429) {
        throw new Error('The daily translation limit has been reached. Please try again tomorrow.');
      }
      const value = result.responseData?.translatedText;
      if (Number(result.responseStatus) !== 200 || typeof value !== 'string' || !value.trim()) {
        throw new Error('Translation is unavailable right now. Please try again.');
      }
      // Decode provider HTML entities into text; React renders it safely.
      const document = new DOMParser().parseFromString(value, 'text/html');
      const decoded = document.body.textContent?.trim();
      if (!decoded) throw new Error('Translation is unavailable right now. Please try again.');
      translated.push(decoded);
    } catch (error) {
      if (controller.signal.aborted && !signal.aborted) {
        throw new Error('Translation took too long. Please try again.');
      }
      if (error instanceof TypeError) throw new Error('Translation is unavailable right now. Please try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
    }
  }
  const value = translated.join(' ');
  if (value) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(original, value);
  }
  return value;
}
