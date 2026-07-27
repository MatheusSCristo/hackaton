export class InvalidLlmResponseException extends Error {
  constructor(reason: string) {
    super(`Invalid LLM response: ${reason}`);
    this.name = "InvalidLlmResponseException";
  }
}
