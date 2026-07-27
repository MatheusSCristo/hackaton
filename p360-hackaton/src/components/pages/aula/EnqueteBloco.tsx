import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import { Check, RefreshCw, Sparkles } from "lucide-react";

import { useGerarEnquete } from "@/hooks/useEnquete";
import type { Bloco, PerguntaEnquete } from "@/services/blocos";

interface EnqueteBlocoProps {
  aulaId: string;
  bloco: Bloco;
}

/**
 * Preparação da enquete: **gerar** o rascunho com a IA e revisar as questões.
 *
 * Publicar no poll360 e conduzir ao vivo ficam na tela de apresentação — ali o
 * professor já está com o projetor na mão, e duplicar o controle aqui só rendia
 * cliques a mais e o risco de publicar o mesmo pacote duas vezes.
 */
export default function EnqueteBloco({ aulaId, bloco }: EnqueteBlocoProps) {
  const gerar = useGerarEnquete(aulaId);

  const output = bloco.output ?? {};
  const perguntas: PerguntaEnquete[] = Array.isArray(output.perguntas)
    ? output.perguntas
    : [];
  const publicada = Boolean(output.poll360PackageId);

  const erro = gerar.error ? mensagemErro(gerar.error) : null;

  return (
    <Box pl={{ base: 0, md: 12 }}>
      <HStack gap="2" wrap="wrap" mb={perguntas.length > 0 ? 4 : 0}>
        <CustomButton
          variant={perguntas.length > 0 ? "outline" : "solid"}
          icon={perguntas.length > 0 ? RefreshCw : Sparkles}
          size="sm"
          isLoading={gerar.isPending}
          disabled={publicada}
          onClick={() => gerar.mutate({ blocoId: bloco.id })}
        >
          {perguntas.length > 0 ? "Gerar novamente" : "Gerar questões com IA"}
        </CustomButton>

        {perguntas.length > 0 && (
          <Text fontSize="xs" color="gray.500">
            {publicada
              ? "Publicada. A condução é na tela de apresentação."
              : "Pronta. A apresentação publica e conduz automaticamente."}
          </Text>
        )}
      </HStack>

      {erro && (
        <Box
          bg="red.50"
          borderWidth="1px"
          borderColor="red.200"
          borderRadius="lg"
          p="3"
          mt="3"
        >
          <Text fontSize="xs" color="red.700">
            {erro}
          </Text>
        </Box>
      )}

      {perguntas.length > 0 && (
        <Stack gap="3" mt="4">
          <Flex align="center" justify="space-between">
            <Heading size="xs" color="gray.700">
              {perguntas.length}{" "}
              {perguntas.length === 1 ? "questão" : "questões"}
              {output.focoAplicado === "fraquezas"
                ? " · focadas nos pontos fracos"
                : ""}
            </Heading>
            {!publicada && (
              <Text fontSize="2xs" color="gray.400">
                Revise antes de publicar
              </Text>
            )}
          </Flex>

          {perguntas.map((pergunta, index) => (
            <PerguntaCard
              key={`${index}-${pergunta.enunciado.slice(0, 20)}`}
              pergunta={pergunta}
              numero={index + 1}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function PerguntaCard({
  pergunta,
  numero,
}: {
  pergunta: PerguntaEnquete;
  numero: number;
}) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p="3">
      <Text fontWeight="semibold" fontSize="sm" color="gray.900" mb="2">
        {numero}. {pergunta.enunciado}
      </Text>
      <Stack gap="1.5">
        {pergunta.opcoes.map((opcao, index) => (
          <Flex key={index} gap="2" align="flex-start">
            <Flex
              w="16px"
              h="16px"
              flexShrink={0}
              mt="0.5"
              align="center"
              justify="center"
              borderRadius="sm"
              borderWidth="1px"
              borderColor={opcao.correta ? "green.500" : "gray.300"}
              bg={opcao.correta ? "green.500" : "white"}
            >
              {opcao.correta && (
                <Check size={10} color="white" strokeWidth={3} />
              )}
            </Flex>
            <Box minW="0">
              <Text
                fontSize="xs"
                color={opcao.correta ? "gray.900" : "gray.600"}
                fontWeight={opcao.correta ? "medium" : "normal"}
              >
                {opcao.texto}
              </Text>
              {opcao.justificativa && (
                <Text fontSize="2xs" color="gray.500" lineHeight="1.4">
                  {opcao.justificativa}
                </Text>
              )}
            </Box>
            {opcao.correta && (
              <Badge
                variant="subtle"
                colorPalette="green"
                borderRadius="full"
                fontSize="2xs"
                ml="auto"
              >
                correta
              </Badge>
            )}
          </Flex>
        ))}
      </Stack>
    </Box>
  );
}

/** Extrai a mensagem do backend (Nest devolve `{ message }`). */
function mensagemErro(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
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
