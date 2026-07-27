import Environment from "@/config/env";

/**
 * Manda o aluno para o `p360-auth-front` e volta para onde ele estava.
 *
 * Contrato do auth (`AuthContext.tsx`): ele lê `?continue=<url>`, guarda em
 * `localStorage` e, após o login, redireciona para `<url>?t=<token>`. O nosso
 * boot captura o `?t=` (ver `accessToken.ts`) e o limpa da barra de endereço.
 */
export function irParaLogin(urlDeRetorno: string = window.location.href): void {
  const base = Environment.VITE_P360_AUTH_URL.replace(/\/+$/, "");
  const destino = `${base}/login?continue=${encodeURIComponent(
    semTokenNaUrl(urlDeRetorno),
  )}`;
  window.location.href = destino;
}

/** Evita levar um token velho no `continue` e voltar com dois na URL. */
function semTokenNaUrl(href: string): string {
  try {
    const url = new URL(href);
    url.searchParams.delete("accessToken");
    url.searchParams.delete("t");
    return url.toString();
  } catch {
    return href;
  }
}
