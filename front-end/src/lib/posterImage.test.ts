import { posterThumbnail, posterThumbnailSet } from './posterImage';
const original='https://culturekit-assets.imgix.net/1/assets/poster.jpg?existing=value';
test('grid artwork uses bounded CDN thumbnails and preserves existing parameters', () => {
  const url=new URL(posterThumbnail(original,640));
  expect(url.searchParams.get('w')).toBe('640');
  expect(url.searchParams.get('h')).toBe('960');
  expect(url.searchParams.get('existing')).toBe('value');
  expect(url.searchParams.get('fit')).toBe('crop');
  expect(posterThumbnailSet(original)).toContain('960w');
});
test.each(['https://example.com/poster.jpg','/local-poster.png','invalid',''])('other artwork is left intact: %s', source => {
  expect(posterThumbnail(source,320)).toBe(source);
  expect(posterThumbnailSet(source)).toBeUndefined();
});
