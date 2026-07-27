import { InvalidLlmResponseException } from "./exceptions/invalid-llm-response.exception";

const FENCED_BLOCK_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function buildParseCandidates(rawJson: string): string[] {
  const trimmed = rawJson.trim();
  const candidates = [trimmed];

  const fencedMatch = trimmed.match(FENCED_BLOCK_PATTERN);
  if (fencedMatch) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return candidates;
}

/** Extrai e faz parse do JSON retornado pelo modelo, tolerando cercas ```json e texto ao redor. */
export function parseLlmJson(rawJson: string): unknown {
  const candidates = buildParseCandidates(rawJson);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  throw new InvalidLlmResponseException("response is not valid JSON");
}
