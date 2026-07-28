import { useParams } from "react-router";
import {
  Badge,
  Box,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@cursosactive/p360-new-ui";
import { ClipboardList, PartyPopper, Stethoscope } from "lucide-react";
import QRCode from "react-qr-code";

import { BLOCO_META, momentoDoTipo } from "../aula/blocoMeta";
import { PresentationRenderer } from "../aula/presentation";
import { useApresentacaoSync } from "@/hooks/useApresentacaoSync";
import type { EnqueteProjecao } from "@/hooks/useApresentacaoSync";
import { useBlocos } from "@/hooks/useBlocos";
import { useSessaoAtual } from "@/hooks/useSessao";
import { useSessaoLive } from "@/hooks/useSessaoLive";
import type { Bloco } from "@/services/blocos";
import type { Apresentacao, SimuladoGerado } from "@/services/materiais";
import type { TipoBloco } from "@/services/blocos";
import { getAccessToken } from "@/utils/accessToken";
import { urlDeEntradaNaEnquete } from "@/utils/enquete";

/**
 * Tela projetada — o que a **turma** vê.
 *
 * Segue a janela de controle por `BroadcastChannel`. Só mostra conteúdo: nada de
 * botões, notas do apresentador ou dados que o professor ainda não liberou.
 */
export default function ProjecaoPage() {
  const { aulaId } = useParams<{ aulaId: string }>();
  const { estado } = useApresentacaoSync(aulaId, "projecao");
  const { data: blocos } = useBlocos(aulaId);
  const { data: sessaoRest } = useSessaoAtual(aulaId);
  // Socket, e não só o REST: a projeção precisa **sair** da tela de QR Code no
  // instante em que o professor clica em "Iniciar aula". O `useSessaoAtual` para
  // de refazer a consulta assim que encontra a sessão, então sozinho ele nunca
  // veria a mudança de `aguardando` para `ativa`.
  const live = useSessaoLive(sessaoRest?.codigo);
  const sessao = live.estado ?? sessaoRest ?? null;

  const sequencia = (blocos ?? []).filter(
    (b) => momentoDoTipo(b.tipo) === "sessao",
  );
  const bloco = sequencia[estado.passo];

  if (estado.finalizada) {
    return (
      <Palco>
        <Flex direction="column" align="center" gap="4">
          <PartyPopper size={56} color="#62C4CE" />
          <Heading size="2xl" color="white" textAlign="center">
            Aula concluída
          </Heading>
          <Text fontSize="xl" color="whiteAlpha.700" textAlign="center">
            Obrigado pela participação!
          </Text>
        </Flex>
      </Palco>
    );
  }

  // A projeção recebe o token pela URL ao ser aberta pelo controle
  // (`sessionStorage` é por aba). Abrir esta rota direto cai aqui.
  if (!getAccessToken()) {
    return (
      <Palco>
        <Stack gap="3" textAlign="center">
          <Heading size="lg" color="white">
            Abra a projeção pela tela de controle
          </Heading>
          <Text fontSize="lg" color="whiteAlpha.700">
            No modo apresentação, use o botão <b>Abrir projeção</b> — é ele que
            autentica esta janela.
          </Text>
        </Stack>
      </Palco>
    );
  }

  if (!blocos) {
    return (
      <Palco>
        <Spinner color="whiteAlpha.700" size="lg" />
      </Palco>
    );
  }

  /**
   * Sala aberta, aula ainda não iniciada: esta tela **é** a entrada da turma.
   *
   * Era uma janela separada (`/aulas/:id/sessao/abrir`) que o professor abria à
   * parte. Ela não tinha como existir junto do conteúdo, e o projetor ficava
   * mostrando a tela errada na hora em que a turma precisava do código.
   */
  if (sessao?.status === "aguardando") {
    return (
      <Palco>
        <Flex direction="column" align="center" gap="6">
          <Heading size="2xl" color="white" textAlign="center">
            Entre na aula
          </Heading>
          <EntradaComQr
            url={`${window.location.origin}/sala/${sessao.codigo}`}
            rotulo="Código da sala"
            valor={sessao.codigo}
            cor="cyan.200"
          />
        </Flex>
      </Palco>
    );
  }

  if (!bloco) {
    return (
      <Palco>
        <Heading size="xl" color="whiteAlpha.800" textAlign="center">
          Aguardando o professor iniciar
        </Heading>
      </Palco>
    );
  }

  if (bloco.tipo === "slides") {
    return <ProjecaoSlides bloco={bloco} indice={estado.slide} />;
  }

  if (bloco.tipo === "caso") {
    return (
      <ProjecaoCaso
        codigo={sessao?.codigo}
        mostrarDados={estado.projetarDados}
        bloco={bloco}
      />
    );
  }

  if (bloco.tipo === "enquete") {
    return (
      <ProjecaoEnquete
        bloco={bloco}
        mostrarDados={estado.projetarDados}
        enquete={estado.enquete}
        codigo={sessao?.codigo}
      />
    );
  }

  const meta = BLOCO_META[bloco.tipo as TipoBloco];
  return (
    <Palco>
      <Heading size="xl" color="white" textAlign="center">
        {meta?.titulo ?? bloco.tipo}
      </Heading>
    </Palco>
  );
}

/**
 * Bloco de entrada projetado: QR grande + o código legível.
 *
 * O QR fica em fundo branco de propósito — leitores têm dificuldade com código
 * claro sobre fundo escuro, e o palco da projeção é escuro.
 */
/** `https://` só ocupa espaço na projeção — o navegador resolve sem ele. */
function semProtocolo(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function EntradaComQr({
  url,
  rotulo,
  valor,
  cor,
}: {
  url: string;
  rotulo: string;
  valor: string;
  cor: string;
}) {
  return (
    <Flex
      align="center"
      gap={{ base: 6, md: 10 }}
      direction={{ base: "column", md: "row" }}
      mt="2"
    >
      {url && (
        <Box bg="white" p="4" borderRadius="xl">
          <QRCode value={url} size={220} level="M" />
        </Box>
      )}

      <Stack gap="4" textAlign={{ base: "center", md: "left" }}>
        {/* Quem está no notebook não escaneia: digita. Por isso a URL vem
            grande e com contraste alto, não como legenda do QR. */}
        {url && (
          <Box>
            <Text fontSize="md" color="whiteAlpha.600" mb="1">
              Acesse no navegador
            </Text>
            <Box
              bg="whiteAlpha.100"
              borderWidth="1px"
              borderColor="whiteAlpha.300"
              borderRadius="lg"
              px="5"
              py="3"
              display="inline-block"
            >
              <Text
                fontSize={{ base: "2xl", md: "4xl" }}
                fontWeight="semibold"
                color="white"
                fontFamily="mono"
                lineHeight="1.2"
                wordBreak="break-all"
              >
                {semProtocolo(url)}
              </Text>
            </Box>
          </Box>
        )}

        <Box>
          <Text fontSize="md" color="whiteAlpha.600">
            {rotulo}
          </Text>
          <Text
            fontSize={{ base: "4xl", md: "6xl" }}
            fontWeight="bold"
            color={cor}
            letterSpacing="widest"
            fontFamily="mono"
            lineHeight="1.1"
          >
            {valor}
          </Text>
        </Box>
      </Stack>
    </Flex>
  );
}

/** Fundo escuro de tela cheia — legível de longe, sem distração. */
function Palco({
  children,
  claro,
}: {
  children: React.ReactNode;
  claro?: boolean;
}) {
  return (
    <Flex
      minH="100vh"
      bg={claro ? "white" : "gray.900"}
      align="center"
      justify="center"
      p={{ base: 6, md: 12 }}
    >
      <Box maxW="1200px" w="100%">
        {children}
      </Box>
    </Flex>
  );
}

/**
 * Projeta o slide com o mesmo motor de renderização usado no cockpit/controle
 * (`PresentationRenderer`) — evita duplicar a lógica de imagem de fundo
 * (capa/fechamento) e imagem de tópico (slides de desenvolvimento) num
 * terceiro lugar, que é o que causava essas imagens não aparecerem aqui.
 */
function ProjecaoSlides({ bloco, indice }: { bloco: Bloco; indice: number }) {
  const apresentacao = bloco.output?.apresentacao as Apresentacao | undefined;
  const slides = apresentacao?.slides ?? [];

  if (!apresentacao || slides.length === 0) {
    return (
      <Palco>
        <Heading size="xl" color="whiteAlpha.800" textAlign="center">
          Slides ainda não gerados
        </Heading>
      </Palco>
    );
  }

  const slideIndex = Math.min(indice, slides.length - 1);

  // Sem padding/maxW e sem o letterbox de 16:9 do preview normal: em tela
  // cheia (F11) o slide precisa preencher o monitor inteiro, não sobrar
  // borda preta em volta.
  return (
    <Box position="fixed" inset={0} w="100vw" h="100vh" bg="gray.900">
      <PresentationRenderer presentation={apresentacao} slideIndex={slideIndex} fill />
    </Box>
  );
}

function ProjecaoCaso({
  codigo,
  bloco,
  mostrarDados,
}: {
  codigo?: string;
  bloco: Bloco;
  mostrarDados: boolean;
}) {
  const agregado = bloco.output?.agregado as
    | {
        etapas?: { label: string; porcentagem: number }[];
        taxaConclusao?: number;
      }
    | undefined;

  if (mostrarDados && agregado?.etapas?.length) {
    return (
      <Palco>
        <Stack gap="6">
          <Heading size="xl" color="white">
            Como a turma foi
          </Heading>
          <Stack gap="4">
            {agregado.etapas.map((etapa) => (
              <Box key={etapa.label}>
                <Flex justify="space-between" mb="2">
                  <Text fontSize="xl" color="whiteAlpha.900">
                    {etapa.label}
                  </Text>
                  <Text fontSize="xl" fontWeight="bold" color="white">
                    {etapa.porcentagem}%
                  </Text>
                </Flex>
                <Box
                  h="14px"
                  bg="whiteAlpha.200"
                  borderRadius="full"
                  overflow="hidden"
                >
                  <Box
                    h="full"
                    w={`${etapa.porcentagem}%`}
                    bg={
                      etapa.porcentagem >= 70
                        ? "green.400"
                        : etapa.porcentagem >= 40
                          ? "orange.400"
                          : "red.400"
                    }
                    borderRadius="full"
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Palco>
    );
  }

  return (
    <Palco>
      <Flex direction="column" align="center" gap="5">
        <Stethoscope size={48} color="#62C4CE" />
        <Heading size="2xl" color="white" textAlign="center">
          Caso clínico liberado
        </Heading>
        <Text fontSize="xl" color="whiteAlpha.700" textAlign="center">
          Aponte a câmera para entrar na sala e resolver o caso.
        </Text>
        {codigo && (
          <EntradaComQr
            url={`${window.location.origin}/sala/${codigo}`}
            rotulo="Código da sessão"
            valor={codigo}
            cor="cyan.300"
          />
        )}
      </Flex>
    </Palco>
  );
}

function ProjecaoEnquete({
  bloco,
  mostrarDados,
  enquete,
  codigo,
}: {
  bloco: Bloco;
  mostrarDados: boolean;
  enquete: EnqueteProjecao | null;
  codigo?: string;
}) {
  const pin = bloco.output?.accessPin as string | undefined;
  const joinUrl = urlDeEntradaNaEnquete(
    bloco.output?.joinUrl as string | undefined,
    pin,
  );
  const simulado = bloco.output?.perguntas as
    SimuladoGerado["questions"] | undefined;

  // Barras nativas: os votos chegam pelo socket na janela de controle e são
  // espelhados para cá. Só aparecem quando o professor autoriza.
  if (mostrarDados && enquete) {
    return (
      <Palco>
        <Stack gap="7">
          <Heading
            size={{ base: "lg", md: "2xl" }}
            color="white"
            lineHeight="1.2"
          >
            {enquete.pergunta}
          </Heading>

          <Stack gap="5">
            {enquete.opcoes.map((opcao, i) => (
              <Box key={opcao.id}>
                <Flex justify="space-between" align="baseline" mb="2" gap="4">
                  <Text
                    fontSize={{ base: "md", md: "xl" }}
                    color="whiteAlpha.900"
                  >
                    <Text as="span" color="purple.200" fontWeight="bold">
                      {String.fromCharCode(65 + i)})
                    </Text>{" "}
                    {opcao.texto}
                  </Text>
                  <Text
                    fontSize={{ base: "lg", md: "2xl" }}
                    fontWeight="bold"
                    color="white"
                    whiteSpace="nowrap"
                  >
                    {opcao.pct}%
                  </Text>
                </Flex>
                <Box
                  h="18px"
                  bg="whiteAlpha.200"
                  borderRadius="full"
                  overflow="hidden"
                >
                  <Box
                    h="full"
                    w={`${opcao.pct}%`}
                    bg="purple.400"
                    borderRadius="full"
                    transition="width 0.4s ease"
                  />
                </Box>
              </Box>
            ))}
          </Stack>

          <Text fontSize="lg" color="whiteAlpha.600">
            {enquete.totalVotos} {enquete.totalVotos === 1 ? "voto" : "votos"}
            {enquete.encerrada ? " · encerrada" : ""}
          </Text>
        </Stack>
      </Palco>
    );
  }

  return (
    <Palco>
      <Flex direction="column" align="center" gap="5">
        <ClipboardList size={48} color="#B794F4" />
        <Heading size="2xl" color="white" textAlign="center">
          Enquete ao vivo
        </Heading>

        {pin ? (
          <EntradaComQr
            // Aponta para a sala: o aluno entra uma vez e a enquete aparece
            // embutida ali, sem precisar de um segundo endereço.
            url={
              codigo
                ? `${window.location.origin}/sala/${codigo}`
                : (joinUrl ?? "")
            }
            rotulo="Entre com o código"
            valor={pin}
            cor="purple.200"
          />
        ) : (
          <Text fontSize="xl" color="whiteAlpha.700">
            Preparando a enquete…
          </Text>
        )}

        {/* Resultados ficam no poll360; aqui projetamos só o contexto. */}
        {mostrarDados && simulado && simulado.length > 0 && (
          <Badge
            variant="subtle"
            colorPalette="purple"
            borderRadius="full"
            px="4"
            py="1"
            fontSize="md"
          >
            {simulado.length} questões
          </Badge>
        )}
      </Flex>
    </Palco>
  );
}
