/**
 * Armazenado em `sessionStorage` (NÃO cookie) porque o embed vive num
 * iframe de terceiro relativo ao host legado (avp-empresas). Navegadores
 * modernos (Chrome 113+, Brave, Safari) bloqueiam escrita de
 * `document.cookie` de terceiro por padrão, o que silenciosamente
 * derruba o token e quebra todo header `X-Access-Token` subsequente.
 * `sessionStorage` é particionado por origem do iframe e não sofre esse
 * bloqueio. Também casa com o ciclo de vida da sessão: o token só é
 * válido enquanto o iframe está aberto.
 */
const ACCESS_TOKEN_STORAGE_KEY = "p360_access_token";

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Alguns contextos embarcados desabilitam storage por completo.
    return null;
  }
}

/**
 * Dois formatos de entrada, por origens diferentes:
 * - `?accessToken=` — injetado pelo host avp-empresas no iframe;
 * - `?t=` — devolvido pelo `p360-auth-front` após login
 *   (`AuthContext` redireciona para `${continue}?t=${token}`).
 */
export function readAccessTokenFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("accessToken") ?? params.get("t");
  return raw && raw.trim() !== "" ? raw : null;
}

export function persistAccessToken(token: string): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } catch {
    // Quota / modo privacidade — descarta silenciosamente; o fallback
    // pela URL cobre esse caso.
  }
}

export function getAccessToken(): string | undefined {
  const storage = readStorage();
  if (!storage) return undefined;
  try {
    return storage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearAccessToken(): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function captureAccessTokenFromUrl(): string | null {
  const fromQuery = readAccessTokenFromQuery();
  if (fromQuery) {
    persistAccessToken(fromQuery);
    limparTokenDaUrl();
    return fromQuery;
  }
  return getAccessToken() ?? null;
}

/**
 * Remove o token da barra de endereço depois de guardá-lo — evita que o aluno
 * compartilhe, por acidente, uma URL que carrega credencial.
 */
function limparTokenDaUrl(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("accessToken") && !url.searchParams.has("t"))
    return;

  url.searchParams.delete("accessToken");
  url.searchParams.delete("t");
  window.history.replaceState({}, "", url.toString());
}
