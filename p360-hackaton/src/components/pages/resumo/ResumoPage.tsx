import { useParams } from "react-router";
import {
  Box,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import { BookOpen, LogIn } from "lucide-react";

import { useResumoAluno } from "@/hooks/useSimulado";
import { getAccessToken } from "@/utils/accessToken";
import { irParaLogin } from "@/utils/login";

/**
 * Página do resumo — **pós-aula**, para o aluno ler em casa.
 *
 * Espelha o simulado: fora da sessão ao vivo, liberada quando o professor
 * disponibiliza. Sem ela o botão "disponibilizar para a turma" do resumo não
 * levava a lugar nenhum — só existia o PDF do professor.
 */
export default function ResumoPage() {
  const { blocoId } = useParams<{ blocoId: string }>();
  const { data, isLoading, error } = useResumoAluno(blocoId);

  if (!getAccessToken()) {
    return (
      <Moldura>
        <Aviso
          titulo="Entre com sua conta"
          texto="Este resumo é material da sua turma, então é preciso estar logado no Paciente 360."
          acao={
            <CustomButton
              variant="solid"
              icon={LogIn}
              onClick={() => irParaLogin()}
            >
              Entrar com minha conta
            </CustomButton>
          }
        />
      </Moldura>
    );
  }

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
              ? "Resumo ainda não disponível"
              : "Resumo não encontrado"
          }
          texto={
            status === 403
              ? "Seu professor ainda não disponibilizou este resumo. Tente novamente mais tarde."
              : "Confira o link que você recebeu."
          }
        />
      </Moldura>
    );
  }

  return (
    <Moldura titulo={data.title} subtitulo={data.aulaTitulo}>
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        p={{ base: 5, md: 8 }}
      >
        <Text fontSize="md" color="gray.700" lineHeight="1.7" mb="6">
          {data.introduction}
        </Text>

        <Stack gap="7">
          {data.sections.map((secao, index) => (
            <Box key={index}>
              <Heading size="sm" color="gray.900" mb="2">
                {secao.heading}
              </Heading>
              <Stack gap="3">
                {secao.paragraphs.map((paragrafo, i) => (
                  <Text
                    key={i}
                    fontSize="sm"
                    color="gray.700"
                    lineHeight="1.75"
                  >
                    {paragrafo}
                  </Text>
                ))}
              </Stack>
              {secao.callout && (
                <Box
                  mt="3"
                  bg="blue.50"
                  borderLeftWidth="3px"
                  borderColor="blue.400"
                  borderRadius="md"
                  px="4"
                  py="3"
                >
                  <Text fontSize="sm" color="blue.900" lineHeight="1.6">
                    {secao.callout}
                  </Text>
                </Box>
              )}
            </Box>
          ))}
        </Stack>

        {data.closing && (
          <Box mt="8" pt="5" borderTopWidth="1px" borderColor="gray.200">
            <Text fontSize="sm" color="gray.600" lineHeight="1.7">
              {data.closing}
            </Text>
          </Box>
        )}
      </Box>
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
          <BookOpen size={20} color="#3182CE" />
          <Box minW="0">
            <Heading size="sm" color="gray.900">
              {titulo ?? "Resumo da aula"}
            </Heading>
            {subtitulo && (
              <Text fontSize="xs" color="gray.500">
                {subtitulo}
              </Text>
            )}
          </Box>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="6" maxW="820px" mx="auto">
        {children}
      </Box>
    </Box>
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
      <Text fontSize="sm" color="gray.600" mb={acao ? 4 : 0}>
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
