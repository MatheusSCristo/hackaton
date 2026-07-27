export class LlmProviderUnavailableException extends Error {
  constructor(reason: string) {
    super(`LLM provider unavailable: ${reason}`);
    this.name = "LlmProviderUnavailableException";
  }
}
