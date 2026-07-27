import { useEffect, useMemo, useState } from "react";
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
import { ExternalLink, LogIn, Vote } from "lucide-react";

import SlidesAluno from "./SlidesAluno";
import { useSessaoLive } from "@/hooks/useSessaoLive";
import { autorizarCaso } from "@/services/caso";
import { entrarSessao, getEstadoPorCodigo } from "@/services/sessao";
import type { EstadoSessao } from "@/services/sessao";
import { getAccessToken } from "@/utils/accessToken";
import { irParaLogin } from "@/utils/login";

const ANON_KEY = "p360:sala:anonId";

/** Id estável por navegador — evita contar o mesmo aluno várias vezes. */
function obterAnonId(): string {
  const existente = sessionStorage.getItem(ANON_KEY);
  if (existente) return existente;
  const novo =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(ANON_KEY, novo);
  return novo;
}

/**
 * Sala do aluno: **uma página só**. O aluno abre o link, entra na sala e as
 * atividades aparecem aqui conforme o professor libera — enquete embutida e,
 * quando chegar o bloco de caso, o acesso ao player.
 */
export default function SalaAlunoPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const anonId = useMemo(obterAnonId, []);
  const live = useSessaoLive(codigo);

  const [estadoRest, setEstadoRest] = useState<EstadoSessao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Entra na sala uma vez; o socket assume daí em diante. O REST inicial é o
  // que faz a página funcionar mesmo se o socket falhar.
  useEffect(() => {
    if (!codigo) return;
    let ativo = true;

    (async () => {
      try {
        const estado = await getEstadoPorCodigo(codigo);
        if (!ativo) return;
        setEstadoRest(estado);
        await entrarSessao(codigo, { anonId });
      } catch {
        if (ativo) setErro("Não encontramos esta sessão. Confira o código.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [codigo, anonId]);

  const estado = live.estado ?? estadoRest;

  if (carregando) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  if (erro || !estado) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center" p="6">
        <Box textAlign="center" maxW="420px">
          <Heading size="md" color="gray.800" mb="2">
            Sessão não encontrada
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {erro ?? "Confira o link ou o código informado pelo professor."}
          </Text>
        </Box>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottomWidth="1px" borderColor="gray.200">
        <Flex
          px={{ base: 4, md: 8 }}
          py="4"
          justify="space-between"
          align="center"
          gap="3"
          wrap="wrap"
        >
          <Box>
            <Text fontSize="xs" color="gray.400">
              Sessão {estado.codigo}
            </Text>
            <Heading size="md" color="gray.900">
              {estado.aulaTitulo}
            </Heading>
          </Box>
          <Badge
            variant="subtle"
            colorPalette={estado.status === "encerrada" ? "gray" : "green"}
            borderRadius="full"
            px="3"
            py="1"
          >
            {estado.status === "encerrada" ? "encerrada" : "ao vivo"}
          </Badge>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="8">
        <Box maxW="720px" mx="auto">
          <AtividadeAtual estado={estado} />
        </Box>
      </Box>
    </Box>
  );
}

function AtividadeAtual({ estado }: { estado: EstadoSessao }) {
  if (estado.status === "encerrada") {
    return (
      <Aviso
        titulo="Sessão encerrada"
        texto="O professor encerrou esta sessão. Obrigado por participar!"
      />
    );
  }

  const bloco = estado.blocoAtual;
  const liberado = estado.estadoAtual === "liberado";

  if (!bloco || !liberado) {
    return (
      <Aviso
        titulo="Aguardando o professor"
        texto="A próxima atividade aparecerá aqui automaticamente."
        spinner
      />
    );
  }

  if (bloco.tipo === "enquete") {
    const joinUrl =
      typeof bloco.output?.joinUrl === "string" ? bloco.output.joinUrl : null;
    const pin =
      typeof bloco.output?.accessPin === "string"
        ? bloco.output.accessPin
        : null;

    if (!joinUrl && !pin) {
      return (
        <Aviso
          titulo="Enquete a caminho"
          texto="O professor está preparando a enquete."
          spinner
        />
      );
    }

    return (
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        p="6"
      >
        <Flex align="center" gap="2" mb="2">
          <Vote size={18} color="#805AD5" />
          <Heading size="sm" color="gray.800">
            Enquete ao vivo
          </Heading>
        </Flex>
        <Text fontSize="sm" color="gray.600" mb="4">
          Responda agora. Os resultados aparecem na tela do professor.
        </Text>

        {joinUrl ? (
          <Box
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="lg"
            overflow="hidden"
          >
            <iframe
              src={joinUrl}
              title="Enquete"
              style={{ width: "100%", height: "520px", border: "none" }}
            />
          </Box>
        ) : (
          <Stack gap="2">
            <Text fontSize="xs" color="gray.500">
              Entre na enquete com o código:
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              fontFamily="mono"
              color="gray.900"
            >
              {pin}
            </Text>
          </Stack>
        )}
      </Box>
    );
  }

  if (bloco.tipo === "caso") {
    return <AbrirCaso sessaoId={estado.sessaoId} blocoId={bloco.id} />;
  }

  if (bloco.tipo === "slides") {
    return <SlidesAluno sessaoId={estado.sessaoId} blocoId={bloco.id} />;
  }

  // Simulado e resumo são pós-aula: não aparecem na sessão ao vivo.
  return (
    <Aviso
      titulo="Acompanhe pelo professor"
      texto="Esta atividade é conduzida na tela do professor."
    />
  );
}

/**
 * Hand-off do caso em modo quiosque.
 *
 * O aluno pede autorização (nonce de uso único) e abrimos o player legado em
 * nova aba. O gate é nosso porque o legado não valida a liberação da turma no
 * deep-link do player.
 */
function AbrirCaso({
  sessaoId,
  blocoId,
}: {
  sessaoId: string;
  blocoId: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaLogin, setPrecisaLogin] = useState(!temTokenNaSessao());

  const abrir = async () => {
    setAbrindo(true);
    setErro(null);
    try {
      const { url } = await autorizarCaso(sessaoId, blocoId);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      // 401 aqui não é falha: é aluno sem sessão do Paciente 360.
      if (statusHttp(e) === 401) setPrecisaLogin(true);
      else setErro(mensagemErro(e) ?? "Não foi possível abrir o caso.");
    } finally {
      setAbrindo(false);
    }
  };

  // O caso roda no player do Paciente 360 e registra o desempenho por aluno —
  // sem sessão logada não há como abrir (diferente dos slides, que são livres).
  if (precisaLogin) {
    return (
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="orange.200"
        borderRadius="xl"
        p="6"
      >
        <Heading size="sm" color="gray.800" mb="2">
          Entre com sua conta para abrir o caso
        </Heading>
        <Text fontSize="sm" color="gray.600" mb="4">
          O caso clínico roda na plataforma Paciente 360 e registra o seu
          desempenho, então é preciso estar logado com a sua conta. Você volta
          para esta sessão logo depois.
        </Text>
        <CustomButton
          variant="solid"
          icon={LogIn}
          onClick={() => irParaLogin()}
        >
          Entrar com minha conta
        </CustomButton>
      </Box>
    );
  }

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p="6"
    >
      <Heading size="sm" color="gray.800" mb="2">
        Caso clínico liberado
      </Heading>
      <Text fontSize="sm" color="gray.600" mb="4">
        O caso abre em uma nova aba. Ao terminar, volte para esta página — a
        próxima atividade aparece aqui.
      </Text>
      <CustomButton
        variant="solid"
        icon={ExternalLink}
        isLoading={abrindo}
        onClick={abrir}
      >
        Abrir o caso
      </CustomButton>
      {erro && (
        <Text fontSize="xs" color="red.600" mt="3">
          {erro}
        </Text>
      )}
    </Box>
  );
}

/** Há sessão do Paciente 360 neste navegador? */
function temTokenNaSessao(): boolean {
  return Boolean(getAccessToken());
}

/** Status HTTP do erro do axios, quando houver. */
function statusHttp(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const status = (error as { response?: { status?: unknown } }).response
      ?.status;
    if (typeof status === "number") return status;
  }
  return null;
}

function mensagemErro(error: unknown): string | null {
  if (typeof error === "object" && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return null;
}

function Aviso({
  titulo,
  texto,
  spinner,
}: {
  titulo: string;
  texto: string;
  spinner?: boolean;
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
      {spinner && (
        <Flex justify="center" mb="3">
          <Spinner color="blue.500" />
        </Flex>
      )}
      <Heading size="sm" color="gray.800" mb="1">
        {titulo}
      </Heading>
      <Text fontSize="sm" color="gray.500">
        {texto}
      </Text>
    </Box>
  );
}
