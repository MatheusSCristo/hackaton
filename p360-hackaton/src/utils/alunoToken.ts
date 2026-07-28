const ALUNO_TOKEN_KEY = "p360:aluno:token";

/**
 * Identidade anônima persistente do aluno (sem login) — gerada uma vez e
 * guardada em `localStorage` (não `sessionStorage`: precisa sobreviver a
 * fechar o navegador, já que o simulado é feito em casa e vira métrica de
 * desempenho mais tarde). O mesmo token volta a cada acesso ao mesmo
 * simulado, then o backend reconhece a tentativa já enviada em vez de
 * permitir refazer.
 */
export function getAlunoToken(): string {
  try {
    const existente = localStorage.getItem(ALUNO_TOKEN_KEY);
    if (existente) return existente;

    const novo =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `aluno-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ALUNO_TOKEN_KEY, novo);
    return novo;
  } catch {
    // Sem storage disponível (modo privado etc.) — token só desta execução.
    return `aluno-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
