import { useSession } from '../stores/session';

// O jogo usa a API e as imagens da própria instância, inclusive com .env antigo.
const origin = '';
export const assetUrl = (path) => `${origin}${path}`;
export class ApiError extends Error {
  constructor(message, status, fields = []) { super(message); this.status = status; this.fields = fields; }
}
export async function api(path, options = {}) {
  const saveId = useSession.getState().saveId;
  let response;
  try {
    response = await fetch(`${origin}/api${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(saveId ? { 'X-Save-Id': saveId } : {}), ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch { throw new ApiError('Não foi possível conectar. Verifique se o backend está rodando.', 0); }
  let result;
  try { result = await response.json(); } catch { throw new ApiError('A API não respondeu corretamente. Verifique a conexão com o backend.', response.status); }
  if (!response.ok) {
    if (response.status === 404 && path === '/jogador/save') useSession.getState().logout();
    throw new ApiError(result.error || 'Não foi possível concluir a operação.', response.status, result.fields ?? []);
  }
  return result.data;
}
