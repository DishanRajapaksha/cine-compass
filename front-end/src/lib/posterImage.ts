export function posterThumbnail(source:string,width:number):string {
  try {
    const url = new URL(source);
    if (url.origin !== 'https://culturekit-assets.imgix.net' || !/^\/\d+\/assets\//.test(url.pathname)) return source;
    url.searchParams.set('w',String(width));
    url.searchParams.set('h',String(Math.round(width*1.5)));
    url.searchParams.set('fit','crop');
    url.searchParams.set('auto','format,compress');
    url.searchParams.set('q','80');
    return url.href;
  } catch {return source;}
}
export function posterThumbnailSet(source:string):string|undefined {
  if (posterThumbnail(source,320) === source) return undefined;
  return [320,640,960].map(width=>`${posterThumbnail(source,width)} ${width}w`).join(', ');
}
