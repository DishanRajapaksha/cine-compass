export type Account = { id: string; name: string };
export type Settings = { userId: string; revision: number; values: Record<string, string> };
let csrf: string | undefined;
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (method !== 'GET' && !csrf) csrf = (await api<{token:string}>('/auth/csrf')).token;
  const response = await fetch(`/api${path}`, { method, credentials:'same-origin', headers:method === 'GET' ? {} : {'Content-Type':'application/json','X-CSRF-TOKEN':csrf!}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 400) csrf = undefined;
    throw new ApiError(data.error || (response.status === 401 ? 'Your session has expired. Sign in again.' : 'The account service could not complete the request.'), response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}
export function resetCsrf() { csrf = undefined; }
const decode = (value: string): ArrayBuffer => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)).buffer;
const encode = (value: ArrayBuffer) => btoa(String.fromCharCode(...Array.from(new Uint8Array(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
export function creationOptions(json: any): PublicKeyCredentialCreationOptions {
  return {...json,challenge:decode(json.challenge),user:{...json.user,id:decode(json.user.id)},excludeCredentials:json.excludeCredentials?.map((c:any) => ({...c,id:decode(c.id)}))};
}
export function requestOptions(json: any): PublicKeyCredentialRequestOptions {
  return {...json,challenge:decode(json.challenge),allowCredentials:json.allowCredentials?.map((c:any) => ({...c,id:decode(c.id)}))};
}
export function credentialJson(credential: PublicKeyCredential): string {
  const response = credential.response;
  const common = {id:credential.id,rawId:encode(credential.rawId),type:credential.type,authenticatorAttachment:credential.authenticatorAttachment,clientExtensionResults:credential.getClientExtensionResults()};
  if ('attestationObject' in response) {
    const r = response as AuthenticatorAttestationResponse;
    return JSON.stringify({...common,response:{clientDataJSON:encode(r.clientDataJSON),attestationObject:encode(r.attestationObject),transports:r.getTransports?.() || []}});
  }
  const r = response as AuthenticatorAssertionResponse;
  return JSON.stringify({...common,response:{clientDataJSON:encode(r.clientDataJSON),authenticatorData:encode(r.authenticatorData),signature:encode(r.signature),userHandle:r.userHandle ? encode(r.userHandle) : null}});
}
export async function passkey(operation: 'register'|'login'|'passkeys', name?: string): Promise<Account | undefined> {
  if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error('Passkeys need a supported browser on HTTPS or localhost.');
  const options = await api<any>(`/auth/${operation}/options`, 'POST', operation === 'register' ? {name} : {});
  const credential = (operation === 'login' ? await navigator.credentials.get({publicKey:requestOptions(options)}) : await navigator.credentials.create({publicKey:creationOptions(options)})) as PublicKeyCredential | null;
  if (!credential) throw new Error('No passkey was selected.');
  const result = await api<Account | undefined>(`/auth/${operation}/complete`, 'POST', {credentialJson:credentialJson(credential)});
  resetCsrf();
  return result;
}
