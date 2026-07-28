import { useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  Badge,
  Box,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import { Check, ClipboardList, LockKeyhole, Send, X } from "lucide-react";

import { useResponderSimuladoPorBloco, useSimulado } from "@/hooks/useSimulado";
import type { ResultadoSimulado } from "@/services/materiais";
import { getAlunoToken } from "@/utils/alunoToken";

/**
 * Página do simulado — **pós-aula**, o aluno faz em casa no próprio tempo.
 *
 * Não exige login: a identidade é um token anônimo gerado e persistido no
 * navegador (`getAlunoToken`), o suficiente pra impedir refazer e virar
 * métrica de desempenho. Não depende da sessão ao vivo — o acesso é liberado
 * quando o professor disponibiliza.
 */
export default function SimuladoPage() {
  const { blocoId } = useParams<{ blocoId: string }>();
  const alunoToken = useMemo(getAlunoToken, []);
  const { data, isLoading, error } = useSimulado(blocoId, alunoToken);
  const responder = useResponderSimuladoPorBloco(blocoId, alunoToken);
  const [escolhas, setEscolhas] = useState<Record<number, string>>({});

  if (isLoading) {
    return (
      <Moldura>
        <Flex justify="center" py="12">
          <Spinner color="blue.500" />
        </Flex>
      </Moldura>
    );
  }

  if (error || !data) {
    const status = statusHttp(error);
    return (
      <Moldura>
        <Aviso
          titulo={
            status === 403
              ? "Simulado ainda não disponível"
              : "Simulado não encontrado"
          }
          texto={
            status === 403
              ? "Seu professor ainda não disponibilizou este simulado. Tente novamente mais tarde."
              : "Confira o link que você recebeu."
          }
        />
      </Moldura>
    );
  }

  const resultado = responder.data ?? data.resultado;
  const total = data.questions.length;
  const respondidas = Object.keys(escolhas).length;

  return (
    <Moldura titulo={data.title} subtitulo={data.aulaTitulo}>
      {resultado ? (
        <Resultado
          resultado={resultado}
          gabaritoLiberado={data.gabaritoLiberado}
        />
      ) : (
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="xl"
          p={{ base: 4, md: 6 }}
        >
          <Text fontSize="xs" color="gray.500" mb="4">
            {total} {total === 1 ? "questão" : "questões"} · você tem uma única
            tentativa. {respondidas} de {total} respondidas.
          </Text>

          <Stack gap="5">
            {data.questions.map((questao, index) => (
              <Box key={index}>
                <Text
                  fontWeight="semibold"
                  fontSize="sm"
                  color="gray.900"
                  mb="2"
                >
                  {index + 1}. {questao.statement}
                </Text>
                <Stack gap="1.5">
                  {questao.alternatives.map((alt) => {
                    const marcada = escolhas[index] === alt.label;
                    return (
                      <Flex
                        key={alt.label}
                        as="button"
                        textAlign="left"
                        align="flex-start"
                        gap="2.5"
                        p="2.5"
                        borderWidth="1px"
                        borderColor={marcada ? "blue.500" : "gray.200"}
                        bg={marcada ? "blue.50" : "white"}
                        borderRadius="lg"
                        cursor="pointer"
                        _hover={{
                          borderColor: marcada ? "blue.500" : "gray.300",
                        }}
                        onClick={() =>
                          setEscolhas((atual) => ({
                            ...atual,
                            [index]: alt.label,
                          }))
                        }
                      >
                        <Flex
                          w="20px"
                          h="20px"
                          flexShrink={0}
                          align="center"
                          justify="center"
                          borderRadius="full"
                          borderWidth="1px"
                          borderColor={marcada ? "blue.500" : "gray.300"}
                          bg={marcada ? "blue.500" : "white"}
                          color={marcada ? "white" : "gray.600"}
                          fontSize="2xs"
                          fontWeight="bold"
                        >
                          {alt.label}
                        </Flex>
                        <Text fontSize="sm" color="gray.700">
                          {alt.text}
                        </Text>
                      </Flex>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>

          {responder.error && (
            <Text fontSize="xs" color="red.600" mt="3">
              {mensagemErro(responder.error)}
            </Text>
          )}

          <Flex justify="flex-end" mt="6">
            <CustomButton
              variant="solid"
              icon={Send}
              isLoading={responder.isPending}
              disabled={respondidas === 0}
              onClick={() =>
                responder.mutate(
                  data.questions.map((_, index) => ({
                    questaoIndex: index,
                    alternativaLabel: escolhas[index] ?? null,
                  })),
                )
              }
            >
              Enviar respostas
            </CustomButton>
          </Flex>
        </Box>
      )}
    </Moldura>
  );
}

function Moldura({
  titulo,
  subtitulo,
  children,
}: {
  titulo?: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottomWidth="1px" borderColor="gray.200">
        <Flex
          px={{ base: 4, md: 8 }}
          py="4"
          align="center"
          gap="2"
          maxW="820px"
          mx="auto"
        >
          <ClipboardList size={20} color="#38A169" />
          <Box>
            <Heading size="md" color="gray.900">
              {titulo ?? "Simulado"}
            </Heading>
            {subtitulo && (
              <Text fontSize="xs" color="gray.500">
                {subtitulo}
              </Text>
            )}
          </Box>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="8">
        <Box maxW="820px" mx="auto">
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function Resultado({
  resultado,
  gabaritoLiberado,
}: {
  resultado: ResultadoSimulado;
  gabaritoLiberado: boolean;
}) {
  const cor =
    resultado.percentual >= 70
      ? "green"
      : resultado.percentual >= 50
        ? "orange"
        : "red";

  return (
    <Stack gap="4">
      <Box
        bg="white"
        borderWidth="1px"
        borderColor={`${cor}.300`}
        borderRadius="xl"
        p="6"
        textAlign="center"
      >
        <Text fontSize="xs" color="gray.500" mb="1">
          Sua nota
        </Text>
        <Heading size="lg" color={`${cor}.600`}>
          {resultado.acertos} de {resultado.total}
        </Heading>
        <Badge
          variant="subtle"
          colorPalette={cor}
          borderRadius="full"
          px="3"
          mt="2"
        >
          {resultado.percentual}% de acerto
        </Badge>
      </Box>

      {/* Sem gabarito liberado, o aluno vê a nota mas não as respostas. */}
      {!gabaritoLiberado && (
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="xl"
          p="6"
          textAlign="center"
        >
          <Flex justify="center" mb="2">
            <LockKeyhole size={18} color="#8492A0" />
          </Flex>
          <Heading size="sm" color="gray.800" mb="1">
            Gabarito comentado ainda não liberado
          </Heading>
          <Text fontSize="sm" color="gray.500">
            Quando o professor liberar, você verá aqui a correção de cada
            questão com a explicação.
          </Text>
        </Box>
      )}

      {gabaritoLiberado &&
        resultado.correcao.map((item, index) => (
          <Box
            key={index}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderLeftWidth="3px"
            borderLeftColor={item.acertou ? "green.400" : "red.400"}
            borderRadius="lg"
            p="4"
          >
            <Flex gap="2" align="flex-start" mb="2">
              {item.acertou ? (
                <Check size={16} color="#38A169" strokeWidth={3} />
              ) : (
                <X size={16} color="#E53E3E" strokeWidth={3} />
              )}
              <Text fontWeight="semibold" fontSize="sm" color="gray.900">
                {index + 1}. {item.statement}
              </Text>
            </Flex>

            <Stack gap="1.5" pl="6">
              {item.alternativas.map((alt) => {
                const foiEscolhida = alt.label === item.escolhida;
                const tom = alt.isCorrect
                  ? "green"
                  : foiEscolhida
                    ? "red"
                    : "gray";
                return (
                  <Box key={alt.label}>
                    <Text
                      fontSize="xs"
                      color={`${tom}.${alt.isCorrect || foiEscolhida ? 700 : 600}`}
                      fontWeight={alt.isCorrect ? "semibold" : "normal"}
                    >
                      <b>{alt.label})</b> {alt.text}
                      {alt.isCorrect && " ✓"}
                      {foiEscolhida && !alt.isCorrect && " ← sua resposta"}
                    </Text>
                    {foiEscolhida &&
                      !alt.isCorrect &&
                      alt.explicacaoSeIncorreta && (
                        <Text fontSize="2xs" color="red.600" mt="0.5">
                          {alt.explicacaoSeIncorreta}
                        </Text>
                      )}
                  </Box>
                );
              })}
            </Stack>

            <Box
              mt="2.5"
              ml="6"
              bg="green.50"
              borderRadius="md"
              px="2.5"
              py="1.5"
            >
              <Text fontSize="2xs" color="green.800">
                {item.explicacao}
              </Text>
            </Box>
          </Box>
        ))}
    </Stack>
  );
}

function Aviso({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderStyle="dashed"
      borderRadius="xl"
      p="10"
      textAlign="center"
    >
      <Heading size="sm" color="gray.800" mb="1">
        {titulo}
      </Heading>
      <Text fontSize="sm" color="gray.500" mb={acao ? 4 : 0}>
        {texto}
      </Text>
      {acao}
    </Box>
  );
}

function statusHttp(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const status = (error as { response?: { status?: unknown } }).response
      ?.status;
    if (typeof status === "number") return status;
  }
  return null;
}

function mensagemErro(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return "Não foi possível enviar suas respostas.";
}
