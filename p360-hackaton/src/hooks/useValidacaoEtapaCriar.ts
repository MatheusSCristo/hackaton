import { useAulaStore } from "@/store/aulaStore";

/**
 * Validação da etapa "Criar" — usada tanto pelo botão "Próxima etapa" quanto
 * pelo clique direto na aba "2. Materiais" (ambos devem travar do mesmo jeito
 * se os campos obrigatórios não estiverem preenchidos).
 */
export function useValidacaoEtapaCriar() {
  const { mode, selectedCaseId, tema, publico, duracao } = useAulaStore();

  const erroPontoDePartida =
    mode === "caso"
      ? !selectedCaseId
        ? "Selecione um caso clínico do acervo."
        : null
      : !tema.trim()
        ? "Descreva o tema da aula."
        : null;
  const erroPublico = !publico ? "Selecione o público-alvo." : null;
  const erroDuracao = !duracao ? "Selecione a duração da aula." : null;

  const valido = !erroPontoDePartida && !erroPublico && !erroDuracao;

  return { erroPontoDePartida, erroPublico, erroDuracao, valido };
}
