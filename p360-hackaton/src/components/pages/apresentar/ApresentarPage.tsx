import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  LogIn,
  PlayCircle,
  Radio,
  RefreshCw,
  Square,
  Users,
  X,
} from "lucide-react";
import QRCode from "react-qr-code";

import { BLOCO_META, momentoDoTipo } from "../aula/blocoMeta";
import { PresentationViewer } from "../aula/presentation";
import { useApresentacaoSync } from "@/hooks/useApresentacaoSync";
import type {
  EnqueteProjecao,
  EstadoApresentacao,
} from "@/hooks/useApresentacaoSync";
import { useAula } from "@/hooks/useAulas";
import { useBlocos } from "@/hooks/useBlocos";
import {
  useAtualizarSlideSessao,
  useConfirmarInicioSessao,
  useCriarSessao,
  useEncerrarSessao,
  useLiberarBloco,
  useSessaoAtual,
} from "@/hooks/useSessao";
import {
  useEncerrarCaso,
  useLiberarCaso,
  useProgressoCaso,
} from "@/hooks/useCaso";
import {
  useIniciarEnquete,
  usePublicarEnquete,
  useRegistrarResultadoEnquete,
  useTrocarQuestaoAtual,
} from "@/hooks/useEnquete";
import { useEnqueteLive } from "@/hooks/useEnqueteLive";
import { useSessaoLive } from "@/hooks/useSessaoLive";
import type { Bloco } from "@/services/blocos";
import type { Apresentacao } from "@/services/materiais";
import type { TipoBloco } from "@/services/blocos";
import type { EstadoSessao } from "@/services/sessao";
import { getAccessToken } from "@/utils/accessToken";
import { irParaLogin } from "@/utils/login";

/**
 * Modo apresentação — janela de **controle** (fica no notebook do professor).
 *
 * A projeção é uma segunda janela (`/projetar`) sincronizada por
 * `BroadcastChannel`. É essa separação que permite ao professor **ver os dados
 * antes de decidir projetá-los**.
 *
 * Avançar de etapa faz duas coisas de uma vez: move a projeção e **libera o
 * bloco para a turma** (o mesmo caminho do cockpit, então a sala do aluno reage
 * pelo socket da sessão).
 */
export default function ApresentarPage() {
  const { aulaId } = useParams<{ aulaId: string }>();
  const navigate = useNavigate();

  const { data: aula } = useAula(aulaId);
  const { data: blocos, isLoading } = useBlocos(aulaId);
  const { data: sessaoRest } = useSessaoAtual(aulaId);
  const live = useSessaoLive(sessaoRest?.codigo);
  const sessao = live.estado ?? sessaoRest ?? null;

  const liberar = useLiberarBloco(aulaId);
  const liberarCaso = useLiberarCaso(aulaId);
  const encerrarSessao = useEncerrarSessao(aulaId);
  const criarSessao = useCriarSessao(aulaId);
  const confirmarSessao = useConfirmarInicioSessao(aulaId);

  const { estado, atualizar } = useApresentacaoSync(aulaId, "controle");

  const sequencia = (blocos ?? []).filter(
    (b) => momentoDoTipo(b.tipo) === "sessao",
  );
  const bloco = sequencia[estado.passo];
  const ultimo = estado.passo >= sequencia.length - 1;

  /**
   * Sala aberta e esperando a turma entrar.
   *
   * Enquanto está assim, a projeção mostra o QR Code e a apresentação não
   * começou: liberar a primeira etapa agora projetaria conteúdo em cima do
   * código de entrada, com metade da turma ainda entrando.
   */
  const aguardandoTurma = sessao?.status === "aguardando";

  /** Libera o bloco da etapa para a turma (caso tem rota própria). */
  const liberarEtapa = (alvo: Bloco | undefined) => {
    if (!alvo || !sessao) return;
    if (alvo.tipo === "caso") {
      if (alvo.output?.cursoLegacyId) {
        liberarCaso.mutate({ blocoId: alvo.id, sessaoId: sessao.sessaoId });
      }
      return;
    }
    liberar.mutate({ sessaoId: sessao.sessaoId, blocoId: alvo.id });
  };

  const irPara = (passo: number) => {
    const alvo = sequencia[passo];
    if (!alvo) return;
    atualizar({ passo, slide: 0, projetarDados: false });
    liberarEtapa(alvo);
  };

  // `irPara` só libera a etapa quando o professor clica em "Próxima
  // etapa"/numa badge — mas ao ABRIR esta tela (ou reabri-la depois), o
  // `bloco` atual já é exibido localmente sem nunca ter sido liberado de
  // verdade na sessão. Resultado: o professor vê os slides passando, mas a
  // turma conectada nunca recebe nada (ficava esperando pra sempre). Este
  // efeito garante que a etapa em tela esteja sempre liberada na sessão,
  // não só localmente — idempotente, então não tem problema repetir a
  // mesma chamada que `irPara` já fez.
  useEffect(() => {
    if (aguardandoTurma) return;
    liberarEtapa(bloco);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco?.id, sessao?.sessaoId, aguardandoTurma]);

  /**
   * "Iniciar aula": confirma a sessão e libera a primeira etapa.
   *
   * Eram dois lugares diferentes (a janela de QR Code criava a sessão, o
   * cockpit confirmava) para uma decisão só — "a turma entrou, vamos começar".
   */
  const iniciarAula = () => {
    if (!sessao) return;
    confirmarSessao.mutate(sessao.sessaoId, {
      onSuccess: () => liberarEtapa(sequencia[estado.passo]),
    });
  };

  // Sem token não há o que apresentar: toda chamada daria 401. Melhor explicar
  // do que deixar o console cuspindo Unauthorized.
  if (!getAccessToken()) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50" p="6">
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="orange.200"
          borderRadius="xl"
          p="8"
          textAlign="center"
          maxW="460px"
        >
          <Heading size="sm" color="gray.800" mb="2">
            Sessão expirada
          </Heading>
          <Text fontSize="sm" color="gray.600" mb="4">
            Entre novamente com sua conta do Paciente 360 para apresentar.
          </Text>
          <CustomButton
            variant="solid"
            icon={LogIn}
            onClick={() => irParaLogin()}
          >
            Entrar com minha conta
          </CustomButton>
        </Box>
      </Flex>
    );
  }

  if (isLoading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Barra superior */}
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
            <Flex
              as="button"
              align="center"
              gap="1"
              color="gray.500"
              cursor="pointer"
              _hover={{ color: "gray.700" }}
              onClick={() => navigate(`/aulas/${aulaId}`)}
            >
              <ArrowLeft size={14} />
              <Text fontSize="sm">Voltar ao cockpit</Text>
            </Flex>
            <Heading size="md" color="gray.900">
              {aula?.titulo ?? "Apresentação"}
            </Heading>
          </Box>

          <HStack gap="2" wrap="wrap">
            {sessao && (
              <Badge
                variant="subtle"
                colorPalette="green"
                borderRadius="full"
                px="3"
                py="1"
              >
                código {sessao.codigo}
              </Badge>
            )}
            <Flex align="center" gap="1" color="gray.600">
              <Users size={14} />
              <Text fontSize="xs">
                {live.conectados ?? sessao?.participantes ?? 0} na sala
              </Text>
            </Flex>
          </HStack>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="6">
        <Box maxW="1100px" mx="auto">
          {/* Sessão: abrir a sala e esperar a turma, aqui mesmo. */}
          {!estado.finalizada && (!sessao || aguardandoTurma) && (
            <ControleSessao
              sessao={aguardandoTurma ? sessao : null}
              codigo={sessao?.codigo}
              conectados={live.conectados}
              abrindo={criarSessao.isPending}
              iniciando={confirmarSessao.isPending}
              cancelando={encerrarSessao.isPending}
              onAbrir={() => criarSessao.mutate()}
              onIniciar={iniciarAula}
              onCancelar={() =>
                sessao && encerrarSessao.mutate(sessao.sessaoId)
              }
            />
          )}

          {/* Enquanto a turma entra, a projeção está no QR Code e a única
              decisão do professor é "começar" — trilha, conteúdo e navegação
              sairiam de cena mesmo, e ficariam só convidando a clicar. */}
          {aguardandoTurma ? null : (
            <>
          {/* Trilha de etapas */}
          <HStack gap="2" wrap="wrap" mb="5">
            {sequencia.map((b, i) => {
              const meta = BLOCO_META[b.tipo as TipoBloco];
              const atual = i === estado.passo;
              return (
                <Badge
                  key={b.id}
                  as="button"
                  variant={atual ? "solid" : "subtle"}
                  colorPalette={atual ? meta?.color : "gray"}
                  borderRadius="full"
                  px="3"
                  py="1"
                  cursor="pointer"
                  onClick={() => irPara(i)}
                >
                  {i + 1}. {meta?.titulo ?? b.tipo}
                </Badge>
              );
            })}
            {estado.finalizada && (
              <Badge
                variant="solid"
                colorPalette="gray"
                borderRadius="full"
                px="3"
                py="1"
              >
                encerrada
              </Badge>
            )}
          </HStack>

          {sequencia.length === 0 ? (
            <Aviso texto="Esta aula não tem blocos de sessão. Adicione slides, caso ou enquete na aba Materiais." />
          ) : estado.finalizada ? (
            <Aviso texto="Sessão encerrada. A projeção está mostrando a tela de fechamento." />
          ) : (
            <EtapaAtual
              aulaId={aulaId as string}
              bloco={bloco}
              estado={estado}
              atualizar={atualizar}
              sessao={sessao}
            />
          )}

          {/* Navegação */}
          <Flex
            justify="space-between"
            align="center"
            gap="3"
            mt="6"
            wrap="wrap"
          >
            <CustomButton
              variant="outline"
              icon={ChevronLeft}
              size="sm"
              disabled={estado.passo === 0 || estado.finalizada}
              onClick={() => irPara(estado.passo - 1)}
            >
              Etapa anterior
            </CustomButton>

            {ultimo ? (
              <CustomButton
                variant="solid"
                icon={Flag}
                disabled={estado.finalizada}
                onClick={() => {
                  atualizar({ finalizada: true, projetarDados: false });
                  if (sessao) encerrarSessao.mutate(sessao.sessaoId);
                }}
              >
                Encerrar aula
              </CustomButton>
            ) : (
              <CustomButton
                variant="solid"
                icon={ChevronRight}
                disabled={estado.finalizada}
                onClick={() => irPara(estado.passo + 1)}
              >
                Próxima etapa
              </CustomButton>
            )}
          </Flex>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Abrir a sala e colocar a aula no ar — as duas coisas aqui, não em telas
 * separadas.
 *
 * Antes: o cockpit abria um pop-up que criava a sessão e mostrava o QR Code, e a
 * confirmação ficava de volta no cockpit. Três superfícies para uma sequência
 * que é sempre a mesma — abrir, esperar a turma, começar.
 *
 * O QR grande vive na **projeção**; aqui ele aparece pequeno só para o professor
 * conferir que a tela certa está no projetor, junto do que só ele deve ver: a
 * contagem de quem já entrou.
 */
function ControleSessao({
  sessao,
  codigo,
  conectados,
  abrindo,
  iniciando,
  cancelando,
  onAbrir,
  onIniciar,
  onCancelar,
}: {
  sessao: EstadoSessao | null;
  codigo: string | undefined;
  conectados: number | null;
  abrindo: boolean;
  iniciando: boolean;
  cancelando: boolean;
  onAbrir: () => void;
  onIniciar: () => void;
  onCancelar: () => void;
}) {
  if (!sessao) {
    return (
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        p={{ base: 4, md: 5 }}
        mb="5"
      >
        <Heading size="sm" color="gray.800" mb="1">
          Sessão ao vivo
        </Heading>
        <Text fontSize="sm" color="gray.500" mb="4">
          Abra a sessão para o QR Code de entrada aparecer na projeção.
        </Text>
        <CustomButton
          variant="solid"
          icon={Radio}
          size="sm"
          isLoading={abrindo}
          onClick={onAbrir}
        >
          Abrir sessão
        </CustomButton>
      </Box>
    );
  }

  const url = codigo ? `${window.location.origin}/sala/${codigo}` : "";
  const naSala = conectados ?? sessao.participantes;

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="orange.300"
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
      mb="5"
    >
      <Flex gap={{ base: 4, md: 6 }} wrap="wrap" align="flex-start">
        {url && (
          <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p="2">
            <QRCode value={url} size={104} level="M" />
          </Box>
        )}

        <Box flex="1" minW="240px">
          <Heading size="sm" color="gray.800" mb="1">
            Esperando a turma entrar
          </Heading>
          <Text fontSize="sm" color="gray.500" mb="3">
            O QR Code está na projeção. Código{" "}
            <Text as="span" fontFamily="mono" fontWeight="bold" color="gray.800">
              {codigo}
            </Text>
            .
          </Text>

          <Flex align="center" gap="2" color="gray.600" mb="4">
            <Users size={14} />
            <Text fontSize="sm" fontWeight="semibold">
              {naSala} {naSala === 1 ? "aluno na sala" : "alunos na sala"}
            </Text>
          </Flex>

          <HStack gap="2" wrap="wrap">
            <CustomButton
              variant="solid"
              icon={PlayCircle}
              size="sm"
              isLoading={iniciando}
              onClick={onIniciar}
            >
              Iniciar aula
            </CustomButton>
            <CustomButton
              variant="outline"
              icon={X}
              size="sm"
              isLoading={cancelando}
              onClick={onCancelar}
            >
              Cancelar sessão
            </CustomButton>
          </HStack>
        </Box>
      </Flex>
    </Box>
  );
}

interface EtapaProps {
  aulaId: string;
  bloco: Bloco | undefined;
  estado: EstadoApresentacao;
  atualizar: (patch: Partial<EstadoApresentacao>) => void;
  sessao: EstadoSessao | null;
}

function EtapaAtual({
  aulaId,
  bloco,
  estado,
  atualizar,
  sessao,
}: EtapaProps) {
  if (!bloco) return <Aviso texto="Etapa não encontrada." />;

  if (bloco.tipo === "slides") {
    return (
      <ControleSlides
        bloco={bloco}
        estado={estado}
        atualizar={atualizar}
        sessao={sessao}
      />
    );
  }
  if (bloco.tipo === "caso") {
    return (
      <ControleCaso
        aulaId={aulaId}
        bloco={bloco}
        sessaoId={sessao?.sessaoId}
        projetarDados={estado.projetarDados}
        onProjetar={(v) => atualizar({ projetarDados: v })}
      />
    );
  }
  if (bloco.tipo === "enquete") {
    return (
      <ControleEnquete
        aulaId={aulaId}
        bloco={bloco}
        projetarDados={estado.projetarDados}
        onProjetar={(v) => atualizar({ projetarDados: v })}
        onEspelhar={(enquete) => atualizar({ enquete })}
      />
    );
  }
  return <Aviso texto="Esta etapa não tem controle próprio." />;
}

/**
 * Slides: mesmo preview do cockpit (imagem de fundo, imagens dos tópicos,
 * miniaturas), só que com a navegação sincronizada com a projeção — por isso
 * `activeIndex`/`onIndexChange` em vez do índice interno do viewer.
 */
function ControleSlides({
  bloco,
  estado,
  atualizar,
  sessao,
}: {
  bloco: Bloco;
  estado: { slide: number };
  atualizar: (patch: { slide: number }) => void;
  sessao: EstadoSessao | null;
}) {
  const apresentacao = bloco.output?.apresentacao as Apresentacao | undefined;
  const slides = apresentacao?.slides ?? [];
  const indiceAtual = Math.min(estado.slide, Math.max(0, slides.length - 1));
  const slide = slides[indiceAtual];

  const atualizarSlideSessao = useAtualizarSlideSessao();
  // Espelha pra turma sempre que existir sessão (mesmo em "aguardando", antes
  // da confirmação) — quem já entrou pelo QR Code acompanha os slides ao
  // vivo; só uma sessão encerrada (ou nenhuma) não tem pra quem espelhar.
  const irParaSlide = (indice: number) => {
    atualizar({ slide: indice });
    if (sessao && sessao.status !== "encerrada") {
      atualizarSlideSessao.mutate({ sessaoId: sessao.sessaoId, slideAtual: indice });
    }
  };

  if (!apresentacao || !slide) {
    return (
      <Aviso texto="Slides ainda não gerados. Gere no cockpit primeiro." />
    );
  }

  return (
    <Painel titulo="Slides" badge={`${indiceAtual + 1} / ${slides.length}`}>
      <PresentationViewer
        presentation={apresentacao}
        activeIndex={indiceAtual}
        onIndexChange={irParaSlide}
      />

      {slide.speakerNotes && (
        <Box bg="yellow.50" borderRadius="md" p="3" mt="4" mb="4">
          <Text fontSize="2xs" fontWeight="semibold" color="yellow.800" mb="1">
            Suas notas (a turma não vê)
          </Text>
          <Text fontSize="xs" color="gray.700">
            {slide.speakerNotes}
          </Text>
        </Box>
      )}

      <Flex justify="space-between" mt="4">
        <CustomButton
          variant="outline"
          icon={ChevronLeft}
          size="sm"
          disabled={indiceAtual === 0}
          onClick={() => irParaSlide(indiceAtual - 1)}
        >
          Slide anterior
        </CustomButton>
        <CustomButton
          variant="solid"
          icon={ChevronRight}
          size="sm"
          disabled={indiceAtual >= slides.length - 1}
          onClick={() => irParaSlide(indiceAtual + 1)}
        >
          Próximo slide
        </CustomButton>
      </Flex>
    </Painel>
  );
}

/** Caso: acompanha conclusões, encerra e decide se projeta o resultado. */
function ControleCaso({
  aulaId,
  bloco,
  sessaoId,
  projetarDados,
  onProjetar,
}: {
  aulaId: string;
  bloco: Bloco;
  sessaoId: string | undefined;
  projetarDados: boolean;
  onProjetar: (v: boolean) => void;
}) {
  const encerrar = useEncerrarCaso(aulaId);
  const liberado = Boolean(
    bloco.output?.liberadoEm && !bloco.output?.encerradoEm,
  );
  const progresso = useProgressoCaso(aulaId, bloco.id, liberado);
  const agregado = bloco.output?.agregado as
    | {
        taxaConclusao?: number;
        etapas?: { label: string; porcentagem: number }[];
      }
    | undefined;

  if (!bloco.output?.cursoLegacyId) {
    return (
      <Aviso texto="Prepare o caso no cockpit (escolha a turma e clique em Preparar) antes de apresentar." />
    );
  }

  return (
    <Painel
      titulo="Caso clínico"
      badge={liberado ? "liberado" : agregado ? "encerrado" : "aguardando"}
    >
      {progresso.data && (
        <Flex align="center" gap="2" mb="4">
          <Users size={16} color="#2B6CB0" />
          <Text fontSize="lg" fontWeight="semibold" color="gray.800">
            {progresso.data.concluidos} de {progresso.data.alunosTotal}{" "}
            concluíram
          </Text>
          <Text fontSize="xs" color="gray.500">
            · {progresso.data.iniciaram} começaram
          </Text>
        </Flex>
      )}

      <HStack gap="2" wrap="wrap" mb="4">
        {liberado && (
          <CustomButton
            variant="solid"
            icon={Square}
            size="sm"
            isLoading={encerrar.isPending}
            onClick={() =>
              sessaoId && encerrar.mutate({ blocoId: bloco.id, sessaoId })
            }
          >
            Encerrar e coletar
          </CustomButton>
        )}
        {!liberado && !agregado && sessaoId && (
          <Text fontSize="xs" color="gray.500">
            <Radio size={12} style={{ display: "inline" }} /> A etapa libera o
            caso automaticamente ao entrar.
          </Text>
        )}
      </HStack>

      {agregado?.etapas?.length ? (
        <Box borderTopWidth="1px" borderColor="gray.100" pt="3">
          <Flex
            justify="space-between"
            align="center"
            mb="3"
            gap="2"
            wrap="wrap"
          >
            <Text fontSize="sm" fontWeight="semibold" color="gray.800">
              Resultado da turma
            </Text>
            <CustomButton
              variant={projetarDados ? "solid" : "outline"}
              icon={projetarDados ? Eye : EyeOff}
              size="sm"
              onClick={() => onProjetar(!projetarDados)}
            >
              {projetarDados ? "Projetando" : "Projetar para a turma"}
            </CustomButton>
          </Flex>
          <Stack gap="2">
            {agregado.etapas.map((e) => (
              <Flex key={e.label} justify="space-between">
                <Text fontSize="xs" color="gray.600">
                  {e.label}
                </Text>
                <Text fontSize="xs" fontWeight="semibold" color="gray.700">
                  {e.porcentagem}%
                </Text>
              </Flex>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Painel>
  );
}

/**
 * Enquete: controle único da aula, e o mais automático possível.
 *
 * Ao chegar nesta etapa a enquete se publica no poll360 (se ainda não estava),
 * abre a primeira questão e sobe ela ao vivo sozinha. O professor só decide
 * **quando avançar** — e "Próxima questão" mantém o mesmo PIN, porque o
 * poll360 reaproveita o `accessPin` ao trocar a sessão de poll.
 */
function ControleEnquete({
  aulaId,
  bloco,
  projetarDados,
  onProjetar,
  onEspelhar,
}: {
  aulaId: string;
  bloco: Bloco;
  projetarDados: boolean;
  onProjetar: (v: boolean) => void;
  onEspelhar: (e: EnqueteProjecao | null) => void;
}) {
  const publicar = usePublicarEnquete(aulaId);
  const iniciarQuestao = useIniciarEnquete(aulaId);
  const persistirQuestaoAtual = useTrocarQuestaoAtual(aulaId);

  const output = bloco.output ?? {};
  const pin = output.accessPin as string | undefined;
  const publicada = Boolean(output.poll360PackageId);
  const perguntas = Array.isArray(output.perguntas) ? output.perguntas : [];
  const pollIds = Array.isArray(output.poll360PollIds)
    ? (output.poll360PollIds as unknown[]).filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  const total = Number(output.totalQuestoes) || perguntas.length;
  const indice = Number(output.questaoAtual) || 0;

  const live = useEnqueteLive(pin);
  const opcoes = live.pollAtivo?.options ?? [];

  // Uma tentativa por bloco: sem o guard, cada refetch de `blocos` republicaria
  // o pacote (o poll360 não é idempotente aqui) ou reabriria a questão.
  const preparado = useRef<string | null>(null);
  useEffect(() => {
    if (preparado.current === bloco.id) return;
    if (publicar.isPending || iniciarQuestao.isPending) return;

    if (!publicada) {
      if (perguntas.length === 0) return; // nada gerado: cai no aviso abaixo
      preparado.current = bloco.id;
      publicar
        .mutateAsync(bloco.id)
        .then(() => iniciarQuestao.mutateAsync({ blocoId: bloco.id }))
        .catch(() => {
          preparado.current = null;
        });
      return;
    }
    if (!pin) {
      preparado.current = bloco.id;
      iniciarQuestao.mutateAsync({ blocoId: bloco.id }).catch(() => {
        preparado.current = null;
      });
    }
    // Só reage à identidade do bloco e ao que já existe no output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco.id, publicada, pin, perguntas.length]);

  // Assim que somos reconhecidos como speaker, a questão sobe sem clique —
  // a que estava no ar, não a primeira. Reabrir a aba (F5, notebook que dormiu)
  // não é começar de novo: voltar para a questão 1 no meio da enquete jogaria a
  // turma inteira de volta a uma pergunta já respondida.
  const noAr = useRef<string | null>(null);
  useEffect(() => {
    if (!pin || !live.ehSpeaker) return;

    const chave = `${pin}:${indice}`;
    if (live.pollAtivo || noAr.current === chave) return;
    noAr.current = chave;

    // `poll:start` sobe a questão que a SESSÃO tem — o que basta na primeira.
    // Para retomar no meio, dizemos explicitamente qual questão queremos, em
    // vez de confiar que a sessão do poll360 guardou a última troca.
    const alvo = pollIds[indice];
    if (indice > 0 && alvo) live.trocarQuestao(alvo);
    else live.iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, indice, live.ehSpeaker, live.pollAtivo]);

  // Assim que a votação encerra, registra o resultado agregado — é a base
  // da tela de métricas (o poll360 não guarda voto individual pra consulta
  // depois). Uma vez por questão encerrada, mesmo que o componente rerenderize.
  const registrarResultado = useRegistrarResultadoEnquete(aulaId);
  const resultadoRegistrado = useRef<string | null>(null);
  useEffect(() => {
    const chave = `${pin ?? ""}:${indice}`;
    if (!live.encerrada || !live.pollAtivo || resultadoRegistrado.current === chave) {
      return;
    }
    resultadoRegistrado.current = chave;

    const perguntaAtual = perguntas[indice] as
      | { enunciado?: string; opcoes?: { texto?: string; correta?: boolean }[] }
      | undefined;
    const opcoesLocais = perguntaAtual?.opcoes ?? [];

    registrarResultado.mutate({
      blocoId: bloco.id,
      questaoIndex: indice,
      enunciado:
        perguntaAtual?.enunciado ??
        live.pollAtivo?.questionText ??
        live.pollAtivo?.title ??
        "",
      // Casa por posição: o poll360 cria as opções na mesma ordem que
      // enviamos (`displayOrder`), então o índice é o único jeito de saber
      // qual opção era a correta (o poll360 não devolve isso pro speaker).
      opcoes: opcoes.map((opcaoAoVivo, i) => ({
        texto: opcoesLocais[i]?.texto ?? opcaoAoVivo.optionText ?? opcaoAoVivo.text ?? "",
        correta: opcoesLocais[i]?.correta === true,
        votos: live.votos[opcaoAoVivo.id] ?? 0,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.encerrada, pin, indice]);

  const temProxima = indice + 1 < total;
  const temAnterior = indice > 0;

  /**
   * Encerra a questão atual e troca pra outra DENTRO do mesmo PIN — direto no
   * WebSocket do poll360 (`poll:end` + `poll:restart`), que é o único jeito
   * de a turma receber a troca ao vivo. Chamar `iniciarEnquete`/REST de novo
   * (como era antes) reabre uma sessão nova no poll360 sem emitir nenhum
   * evento — por isso a troca não "passava" pro aluno.
   */
  const irParaQuestao = (novoIndice: number) => {
    const pollId = pollIds[novoIndice];
    if (!pollId) return;
    onProjetar(false);
    live.trocarQuestao(pollId);
    // Só bookkeeping (sobrevive a F5) — não é o que troca a tela do aluno.
    persistirQuestaoAtual.mutate({ blocoId: bloco.id, indice: novoIndice });
  };

  const proximaQuestao = () => temProxima && irParaQuestao(indice + 1);
  const questaoAnterior = () => temAnterior && irParaQuestao(indice - 1);

  const pergunta =
    live.pollAtivo?.questionText ?? live.pollAtivo?.title ?? null;

  // Espelha o estado ao vivo para a projeção. A chave de dependência é
  // serializada para não republicar a cada render sem mudança real.
  const assinatura = JSON.stringify({
    pergunta,
    votos: live.votos,
    total: live.totalVotos,
    encerrada: live.encerrada,
    ids: opcoes.map((o) => o.id),
  });

  useEffect(() => {
    if (!pergunta) {
      onEspelhar(null);
      return;
    }
    onEspelhar({
      pergunta,
      totalVotos: live.totalVotos,
      encerrada: live.encerrada,
      opcoes: opcoes.map((o) => {
        const votos = live.votos[o.id] ?? 0;
        return {
          id: o.id,
          texto: o.optionText ?? o.text ?? "",
          votos,
          pct:
            live.totalVotos > 0
              ? Math.round((100 * votos) / live.totalVotos)
              : 0,
        };
      }),
    });
    // `assinatura` cobre pergunta/votos/total/encerrada/ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  if (perguntas.length === 0) {
    return (
      <Aviso texto="Enquete sem questões. Gere as questões com IA no cockpit." />
    );
  }

  if (!pin) {
    const falhou = publicar.error ?? iniciarQuestao.error;
    return (
      <Painel titulo="Enquete" badge="preparando">
        <Text fontSize="sm" color="gray.600">
          {falhou
            ? "Não foi possível preparar a enquete."
            : "Publicando no poll360 e abrindo a primeira questão…"}
        </Text>
        {falhou ? (
          <CustomButton
            variant="solid"
            icon={RefreshCw}
            size="sm"
            mt="3"
            isLoading={publicar.isPending || iniciarQuestao.isPending}
            onClick={() => {
              preparado.current = null;
              publicar.reset();
              iniciarQuestao.reset();
            }}
          >
            Tentar de novo
          </CustomButton>
        ) : (
          <Spinner color="blue.500" size="sm" mt="3" />
        )}
      </Painel>
    );
  }

  return (
    <Painel
      titulo="Enquete ao vivo"
      badge={total > 1 ? `questão ${indice + 1} / ${total}` : `PIN ${pin}`}
    >
      <Flex align="center" gap="2" mb="3" wrap="wrap">
        <Badge
          variant="subtle"
          colorPalette={live.conectado ? "green" : "gray"}
          borderRadius="full"
          fontSize="2xs"
        >
          {live.conectado ? "conectado" : "conectando…"}
        </Badge>
        {live.participantes !== null && (
          <Text fontSize="xs" color="gray.600">
            {live.participantes} na sala
          </Text>
        )}
      </Flex>

      <HStack gap="2" wrap="wrap" mb="4">
        <CustomButton
          variant={projetarDados ? "solid" : "outline"}
          icon={projetarDados ? Eye : EyeOff}
          size="sm"
          disabled={!live.pollAtivo}
          onClick={() => onProjetar(!projetarDados)}
        >
          {projetarDados ? "Projetando votos" : "Projetar votos"}
        </CustomButton>
        <CustomButton
          variant="outline"
          icon={Square}
          size="sm"
          disabled={!live.ehSpeaker || !live.pollAtivo || live.encerrada}
          onClick={live.encerrarQuestao}
        >
          Encerrar votação
        </CustomButton>
        {temAnterior && (
          <CustomButton
            variant="outline"
            icon={ChevronLeft}
            size="sm"
            isLoading={persistirQuestaoAtual.isPending}
            disabled={!live.ehSpeaker}
            onClick={questaoAnterior}
          >
            Questão anterior ({indice}/{total})
          </CustomButton>
        )}
        {temProxima ? (
          <CustomButton
            variant="solid"
            icon={ChevronRight}
            size="sm"
            isLoading={persistirQuestaoAtual.isPending}
            disabled={!live.ehSpeaker}
            onClick={proximaQuestao}
          >
            Próxima questão ({indice + 2}/{total})
          </CustomButton>
        ) : (
          <Text fontSize="xs" color="gray.500">
            Última questão — avance a etapa quando quiser.
          </Text>
        )}
        <CustomButton
          variant="ghost"
          icon={RefreshCw}
          size="sm"
          disabled={!live.ehSpeaker}
          onClick={live.iniciar}
        >
          Reabrir votação
        </CustomButton>
      </HStack>

      {live.erro && (
        <Text fontSize="xs" color="red.600" mb="2">
          {live.erro}
        </Text>
      )}

      {live.pollAtivo && (
        <Box borderTopWidth="1px" borderColor="gray.100" pt="3">
          <Text fontWeight="semibold" fontSize="sm" color="gray.900" mb="1">
            {live.pollAtivo.questionText ?? live.pollAtivo.title}
          </Text>
          <Text fontSize="2xs" color="gray.500" mb="2">
            {live.totalVotos} {live.totalVotos === 1 ? "voto" : "votos"}
          </Text>
          <Stack gap="2">
            {opcoes.map((o) => {
              const v = live.votos[o.id] ?? 0;
              const pct =
                live.totalVotos > 0
                  ? Math.round((100 * v) / live.totalVotos)
                  : 0;
              return (
                <Box key={o.id}>
                  <Flex justify="space-between" mb="1">
                    <Text fontSize="xs" color="gray.600">
                      {o.optionText ?? o.text}
                    </Text>
                    <Text fontSize="xs" fontWeight="semibold" color="gray.700">
                      {v} ({pct}%)
                    </Text>
                  </Flex>
                  <Box
                    h="6px"
                    bg="gray.100"
                    borderRadius="full"
                    overflow="hidden"
                  >
                    <Box
                      h="full"
                      w={`${pct}%`}
                      bg="purple.500"
                      borderRadius="full"
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Painel>
  );
}

function Painel({
  titulo,
  badge,
  children,
}: {
  titulo: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p={{ base: 4, md: 6 }}
    >
      <Flex align="center" justify="space-between" gap="2" mb="4" wrap="wrap">
        <Heading size="sm" color="gray.700">
          {titulo}
        </Heading>
        {badge && (
          <Badge variant="subtle" colorPalette="gray" borderRadius="full">
            {badge}
          </Badge>
        )}
      </Flex>
      {children}
    </Box>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderStyle="dashed"
      borderRadius="xl"
      p="8"
      textAlign="center"
    >
      <Text fontSize="sm" color="gray.500">
        {texto}
      </Text>
    </Box>
  );
}
