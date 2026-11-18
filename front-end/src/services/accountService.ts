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
