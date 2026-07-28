/**
 * URL de entrada do aluno na enquete, sempre na forma que entra direto.
 *
 * O poll360 tem duas portas: `/join`, que pede o PIN num campo, e
 * `/sessions/:pin`, que já entra na sessão e manda o aluno para o cadastro
 * (nome) antes de votar. Em sala de aula só a segunda serve — digitar o PIN de
 * novo dentro de uma tela que já sabe o PIN é clique puro.
 *
 * Normalizamos aqui, e não só na geração, porque o `joinUrl` fica gravado no
 * `output` do bloco: enquetes preparadas por versões anteriores carregam o
 * formato `/join?pin=` e continuariam abrindo na tela de digitar código.
 */
export function urlDeEntradaNaEnquete(
  joinUrl: string | null | undefined,
  pin: string | null | undefined,
): string | null {
  if (!joinUrl) return null;

  try {
    const url = new URL(joinUrl);
    const pinDaUrl = url.searchParams.get("pin") ?? pin;

    if (/\/join\/?$/.test(url.pathname) && pinDaUrl) {
      return `${url.origin}/sessions/${encodeURIComponent(pinDaUrl)}`;
    }
    return url.toString();
  } catch {
    // `joinUrl` vazio/inválido: melhor cair no fallback do PIN em tela do que
    // abrir um iframe quebrado.
    return null;
  }
}
