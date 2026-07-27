const Environment = {
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_PORT: import.meta.env.VITE_PORT,
  VITE_HACKATON_API_URL: import.meta.env.VITE_HACKATON_API_URL,
  VITE_HACKATON_API_TOKEN: import.meta.env.VITE_HACKATON_API_TOKEN,
  VITE_USE_MOCK: import.meta.env.VITE_USE_MOCK === "true",
  /**
   * `p360-auth-front`. Usado quando o aluno abre a sala por link avulso e a
   * atividade exige login (caso clínico, simulado). Portas por ambiente seguem
   * o `AUTH_URL` do avp-empresas (local: 4000).
   */
  VITE_P360_AUTH_URL:
    import.meta.env.VITE_P360_AUTH_URL ?? "http://localhost:4000/",
  /**
   * Monolith (poll360). O professor conecta direto no gateway `/ws/poll360`
   * para controlar a enquete ao vivo — é lá que o speaker é reconhecido.
   */
  VITE_POLL360_WS_URL:
    import.meta.env.VITE_POLL360_WS_URL ?? "http://localhost:3001",
  VITE_STORAGE_URL:
    import.meta.env.VITE_STORAGE_URL ??
    "https://s3-sa-east-1.amazonaws.com/avp-development/",
};

export default Environment;
