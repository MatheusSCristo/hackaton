/** Extrai uma mensagem legível de um erro do axios (ou genérico). */
export function mensagemErro(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.join(", ");
    }
    const fallback = (error as { message?: unknown }).message;
    if (typeof fallback === "string") return fallback;
  }
  return "Não foi possível concluir a operação.";
}
