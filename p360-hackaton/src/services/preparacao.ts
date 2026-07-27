import { hackatonApi } from "@/api/api";

export interface PreparoDeBloco {
  blocoId: string;
  tipo: string;
  /** `pronto` = já estava; `preparado` = feito agora; `falhou` = ver `erro`. */
  status: "pronto" | "preparado" | "falhou";
  erro?: string;
}

export interface ResultadoPreparo {
  blocos: PreparoDeBloco[];
  prontos: number;
  falhas: number;
}

/**
 * Deixa a sequência ao vivo pronta num clique: slides gerados, caso com wrapper
 * criado, enquete publicada. Idempotente — chamar de novo não duplica nada.
 */
export async function prepararAula(aulaId: string): Promise<ResultadoPreparo> {
  const { data } = await hackatonApi.post<ResultadoPreparo>(
    `/api/aulas/${aulaId}/preparar`,
    {},
  );
  return data;
}
