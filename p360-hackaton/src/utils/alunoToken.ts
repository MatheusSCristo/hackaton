const ALUNO_TOKEN_KEY = "p360:aluno:token";
const ALUNO_IDENTIDADE_KEY = "p360:aluno:identidade";

export interface IdentidadeAluno {
  nome: string;
  email: string;
}

/**
 * Nome/e-mail que o aluno digitou da primeira vez que abriu um simulado —
 * guardado pra não pedir de novo em simulados seguintes no mesmo navegador.
 */
export function getIdentidadeSalva(): IdentidadeAluno | null {
  try {
    const bruto = localStorage.getItem(ALUNO_IDENTIDADE_KEY);
    if (!bruto) return null;
    const parsed = JSON.parse(bruto) as Partial<IdentidadeAluno>;
    if (typeof parsed.nome === "string" && typeof parsed.email === "string") {
      return { nome: parsed.nome, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function salvarIdentidade(identidade: IdentidadeAluno): void {
  try {
    localStorage.setItem(ALUNO_IDENTIDADE_KEY, JSON.stringify(identidade));
  } catch {
    // Sem storage disponível — segue sem lembrar da próxima vez.
  }
}

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
