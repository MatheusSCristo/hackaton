import { useEffect, useRef, useState } from "react";
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
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Flag,
  LogIn,
  MonitorPlay,
  PlayCircle,
  Radio,
  RefreshCw,
  Square,
  Users,
} from "lucide-react";

import { BLOCO_META, momentoDoTipo } from "../aula/blocoMeta";
import { useApresentacaoSync } from "@/hooks/useApresentacaoSync";
import type {
  EnqueteProjecao,
  EstadoApresentacao,
} from "@/hooks/useApresentacaoSync";
import { useAula } from "@/hooks/useAulas";
import { useBlocos } from "@/hooks/useBlocos";
import {
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
import { useIniciarEnquete, usePublicarEnquete } from "@/hooks/useEnquete";
import { useEnqueteLive } from "@/hooks/useEnqueteLive";
import { usePrepararAula } from "@/hooks/usePreparacao";
import { useSessaoLive } from "@/hooks/useSessaoLive";
import type { Bloco } from "@/services/blocos";
import type { Apresentacao } from "@/services/materiais";
import type { TipoBloco } from "@/services/blocos";
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

  const criarSessao = useCriarSessao(aulaId);
  const liberar = useLiberarBloco(aulaId);
  const liberarCaso = useLiberarCaso(aulaId);
  const encerrarSessao = useEncerrarSessao(aulaId);

  const preparar = usePrepararAula(aulaId);
  const [iniciada, setIniciada] = useState(false);

  const { estado, atualizar } = useApresentacaoSync(aulaId, "controle");

  const sequencia = (blocos ?? []).filter(
    (b) => momentoDoTipo(b.tipo) === "sessao",
  );
  const bloco = sequencia[estado.passo];
  const ultimo = estado.passo >= sequencia.length - 1;

  // A apresentação precisa de sessão aberta: é ela que leva as atividades aos
  // alunos. Abrir sozinho evita um passo manual antes de projetar.
  useEffect(() => {
    if (blocos && !sessaoRest && !criarSessao.isPending) criarSessao.mutate();
    // Só na primeira vez que descobrimos que não há sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocos, sessaoRest]);

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

  /**
   * `sessionStorage` é **por aba**: a janela de projeção nasce sem o token e
   * levaria 401 em toda chamada. Repassamos pela URL — o boot captura
   * `?accessToken=`, persiste e limpa a barra de endereço (ver `accessToken.ts`).
   */
  const abrirProjecao = () => {
    const token = getAccessToken();
    const url = token
      ? `/aulas/${aulaId}/projetar?accessToken=${encodeURIComponent(token)}`
      : `/aulas/${aulaId}/projetar`;

    window.open(url, "p360-projecao", "noopener,width=1280,height=720");
  };

  /**
   * "Iniciar projeção": abre a janela do projetor **e** libera a primeira etapa
   * para a turma. Antes eram duas ações separadas, e dava para ficar projetando
   * sem que os alunos tivessem recebido nada.
   */
  const iniciar = () => {
    abrirProjecao();
    setIniciada(true);
    irPara(estado.passo);
  };

  // Preparo de segurança: quem cai direto em /apresentar (link salvo, refresh)
  // não passou pelo "Visualizar projeção" do overview. Uma tentativa só.
  const preparouRef = useRef(false);
  useEffect(() => {
    if (preparouRef.current || !blocos) return;
    const faltando = blocos.some(
      (b) =>
        (b.tipo === "slides" && !b.output?.apresentacao) ||
        (b.tipo === "caso" && !b.output?.cursoLegacyId) ||
        (b.tipo === "enquete" && !b.output?.poll360PackageId),
    );
    if (!faltando) return;
    preparouRef.current = true;
    preparar.mutate();
    // Só quando a lista de blocos chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocos]);

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
              <Text fontSize="sm">Voltar à aula</Text>
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
            {sessao && <LinkDaTurma codigo={sessao.codigo} />}
            <CustomButton
              variant={iniciada ? "outline" : "solid"}
              icon={iniciada ? MonitorPlay : PlayCircle}
              size="sm"
              onClick={iniciar}
            >
              {iniciada ? "Reabrir projeção" : "Iniciar projeção"}
            </CustomButton>
          </HStack>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="6">
        <Box maxW="1100px" mx="auto">
          {/* Preparo automático: só aparece quando há algo a fazer/informar. */}
          {(preparar.isPending || (preparar.data?.falhas ?? 0) > 0) && (
            <Flex
              align="center"
              gap="2"
              mb="4"
              bg={preparar.isPending ? "blue.50" : "orange.50"}
              borderWidth="1px"
              borderColor={preparar.isPending ? "blue.200" : "orange.200"}
              borderRadius="lg"
              px="4"
              py="3"
            >
              {preparar.isPending && <Spinner size="sm" color="blue.500" />}
              <Text
                fontSize="sm"
                color={preparar.isPending ? "blue.800" : "orange.800"}
              >
                {preparar.isPending
                  ? "Preparando a aula: gerando slides, caso e enquete que faltarem…"
                  : `${preparar.data?.falhas} etapa(s) não ficaram prontas: ${preparar.data?.blocos
                      .filter((b) => b.status === "falhou")
                      .map((b) => `${b.tipo} (${b.erro ?? "erro"})`)
                      .join("; ")}`}
              </Text>
            </Flex>
          )}

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
              sessaoId={sessao?.sessaoId}
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
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Link de entrada da turma, aqui no cabeçalho de propósito: a apresentação deve
 * bastar por si, sem o professor voltar ao overview para pegar o endereço.
 */
function LinkDaTurma({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}/sala/${codigo}`;

  return (
    <CustomButton
      variant="ghost"
      icon={copiado ? Check : Copy}
      size="sm"
      onClick={() => {
        navigator.clipboard
          .writeText(url)
          .then(() => setCopiado(true))
          // Sem permissão de clipboard não há o que fazer além de não travar.
          .catch(() => undefined);
      }}
    >
      {copiado ? "Link copiado" : "Copiar link da turma"}
    </CustomButton>
  );
}

interface EtapaProps {
  aulaId: string;
  bloco: Bloco | undefined;
  estado: EstadoApresentacao;
  atualizar: (patch: Partial<EstadoApresentacao>) => void;
  sessaoId: string | undefined;
}

function EtapaAtual({
  aulaId,
  bloco,
  estado,
  atualizar,
  sessaoId,
}: EtapaProps) {
  if (!bloco) return <Aviso texto="Etapa não encontrada." />;

  if (bloco.tipo === "slides") {
    return (
      <ControleSlides bloco={bloco} estado={estado} atualizar={atualizar} />
    );
  }
  if (bloco.tipo === "caso") {
    return (
      <ControleCaso
        aulaId={aulaId}
        bloco={bloco}
        sessaoId={sessaoId}
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

/** Slides: navegação + notas do apresentador (que a turma não vê). */
function ControleSlides({
  bloco,
  estado,
  atualizar,
}: {
  bloco: Bloco;
  estado: { slide: number };
  atualizar: (patch: { slide: number }) => void;
}) {
  const apresentacao = bloco.output?.apresentacao as Apresentacao | undefined;
  const slides = apresentacao?.slides ?? [];
  const slide = slides[Math.min(estado.slide, Math.max(0, slides.length - 1))];

  if (!slide) {
    return (
      <Aviso texto="Slides ainda não gerados. Gere no cockpit primeiro." />
    );
  }

  return (
    <Painel titulo="Slides" badge={`${estado.slide + 1} / ${slides.length}`}>
      <Heading size="md" color="gray.900" mb="2">
        {slide.title}
      </Heading>
      {slide.content.length > 0 && (
        <Stack gap="1.5" mb="4">
          {slide.content.map((b, i) => (
            <Text key={i} fontSize="sm" color="gray.600">
              • {b}
            </Text>
          ))}
        </Stack>
      )}

      {slide.speakerNotes && (
        <Box bg="yellow.50" borderRadius="md" p="3" mb="4">
          <Text fontSize="2xs" fontWeight="semibold" color="yellow.800" mb="1">
            Suas notas (a turma não vê)
          </Text>
          <Text fontSize="xs" color="gray.700">
            {slide.speakerNotes}
          </Text>
        </Box>
      )}

      <HStack gap="2">
        <CustomButton
          variant="outline"
          icon={ChevronLeft}
          size="sm"
          disabled={estado.slide === 0}
          onClick={() => atualizar({ slide: estado.slide - 1 })}
        >
          Slide anterior
        </CustomButton>
        <CustomButton
          variant="solid"
          icon={ChevronRight}
          size="sm"
          disabled={estado.slide >= slides.length - 1}
          onClick={() => atualizar({ slide: estado.slide + 1 })}
        >
          Próximo slide
        </CustomButton>
      </HStack>
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

  const output = bloco.output ?? {};
  const pin = output.accessPin as string | undefined;
  const publicada = Boolean(output.poll360PackageId);
  const perguntas = Array.isArray(output.perguntas) ? output.perguntas : [];
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

  // Assim que somos reconhecidos como speaker, a questão sobe sem clique.
  const noAr = useRef<string | null>(null);
  useEffect(() => {
    const chave = `${pin ?? ""}:${indice}`;
    if (!pin || !live.ehSpeaker || live.pollAtivo || noAr.current === chave) {
      return;
    }
    noAr.current = chave;
    live.iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, indice, live.ehSpeaker, live.pollAtivo]);

  const temProxima = indice + 1 < total;

  /** Encerra a atual (mostrando resultado) e sobe a seguinte no mesmo PIN. */
  const proximaQuestao = async () => {
    if (!temProxima) return;
    live.encerrarQuestao();
    onProjetar(false);
    await iniciarQuestao.mutateAsync({
      blocoId: bloco.id,
      indice: indice + 1,
    });
    // O `noAr` muda de chave com o novo índice, então o efeito acima sobe a
    // questão nova assim que o output chegar.
  };

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
        {temProxima ? (
          <CustomButton
            variant="solid"
            icon={ChevronRight}
            size="sm"
            isLoading={iniciarQuestao.isPending}
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
