import { useState } from "react";
import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  CustomButton,
  CustomInput,
  CustomSelect,
} from "@cursosactive/p360-new-ui";
import {
  BookOpenCheck,
  Check,
  Download,
  EyeOff,
  LockKeyhole,
  RefreshCw,
  Settings2,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";

import { momentoDoTipo } from "./blocoMeta";
import { useUpdateBloco } from "@/hooks/useBlocos";
import {
  useBaixarMaterial,
  useGerarMaterial,
  useResultadosSimulado,
} from "@/hooks/useMateriais";
import { useDefinirGabarito, usePublicarPosAula } from "@/hooks/useSimulado";
import type { Bloco } from "@/services/blocos";
import type {
  Apresentacao,
  ResumoGerado,
  SimuladoGerado,
} from "@/services/materiais";

type TipoMaterial = "slides" | "simulado" | "resumo";

const N_SLIDES_OPTIONS = [5, 6, 8, 10, 12].map((n) => ({
  value: String(n),
  label: `${n} slides`,
}));

const N_QUESTOES_OPTIONS = [3, 5, 8, 10].map((n) => ({
  value: String(n),
  label: `${n} questões`,
}));

interface MaterialBlocoProps {
  aulaId: string;
  bloco: Bloco;
  tipo: TipoMaterial;
  /** Bloco liberado agora — usado para acompanhar respostas do simulado. */
  liberado: boolean;
}

/**
 * Bloco de material (slides, simulado ou resumo) no cockpit.
 *
 * O professor **não escreve prompt**: o conteúdo é gerado a partir do que ele já
 * escolheu na aula (caso/tema, público, objetivos) e, se houver um bloco de caso
 * antes, dos pontos fracos diagnosticados. "Personalizar" é opcional.
 */
export default function MaterialBloco({
  aulaId,
  bloco,
  tipo,
  liberado,
}: MaterialBlocoProps) {
  const [personalizando, setPersonalizando] = useState(false);
  const atualizar = useUpdateBloco(aulaId);
  const gerar = useGerarMaterial(aulaId);
  const baixar = useBaixarMaterial(aulaId);

  const publicar = usePublicarPosAula(aulaId);
  const gabarito = useDefinirGabarito(aulaId);

  const output = bloco.output ?? {};
  const apresentacao = output.apresentacao as Apresentacao | undefined;
  const simulado = output.simulado as SimuladoGerado | undefined;
  const resumo = output.resumo as ResumoGerado | undefined;
  const gerado = Boolean(apresentacao ?? simulado ?? resumo);
  const publicado = Boolean(output.publicadoEm);
  const gabaritoLiberado = output.gabaritoLiberado === true;

  const resultados = useResultadosSimulado(
    aulaId,
    bloco.id,
    tipo === "simulado" && Boolean(simulado),
  );

  const erro = gerar.error ?? baixar.error;
  const temDownload = tipo === "slides" || tipo === "resumo";

  return (
    <Box pl={{ base: 0, md: 12 }}>
      <HStack gap="2" wrap="wrap" mb="3">
        <CustomButton
          variant={gerado ? "outline" : "solid"}
          icon={gerado ? RefreshCw : Sparkles}
          size="sm"
          isLoading={gerar.isPending}
          onClick={() => gerar.mutate(bloco.id)}
        >
          {gerado ? "Gerar novamente" : "Gerar com IA"}
        </CustomButton>

        {gerado && temDownload && (
          <CustomButton
            variant="outline"
            icon={Download}
            size="sm"
            isLoading={baixar.isPending}
            onClick={() =>
              baixar.mutate({
                blocoId: bloco.id,
                nomeSugerido:
                  tipo === "slides" ? "apresentacao.pptx" : "resumo.pdf",
              })
            }
          >
            {tipo === "slides" ? "Baixar PPTX" : "Baixar PDF"}
          </CustomButton>
        )}

        <CustomButton
          variant="ghost"
          icon={Settings2}
          size="sm"
          onClick={() => setPersonalizando((v) => !v)}
        >
          Personalizar
        </CustomButton>
      </HStack>

      {/* Só pós-aula: "disponibilizar" é o material que o aluno faz em casa.
          Slides são da sessão ao vivo e quem os libera é a tela de apresentação
          ao avançar a etapa — aqui o botão só somava clique. */}
      {gerado && momentoDoTipo(tipo) === "pos_aula" && (
        <HStack gap="2" wrap="wrap" mb="3">
          <CustomButton
            variant={publicado ? "outline" : "solid"}
            icon={publicado ? EyeOff : Share2}
            size="sm"
            isLoading={publicar.isPending}
            onClick={() =>
              publicar.mutate({ blocoId: bloco.id, publicado: !publicado })
            }
          >
            {publicado ? "Recolher da turma" : "Disponibilizar para a turma"}
          </CustomButton>

          {tipo === "simulado" && publicado && (
            <CustomButton
              variant={gabaritoLiberado ? "outline" : "solid"}
              icon={gabaritoLiberado ? LockKeyhole : BookOpenCheck}
              size="sm"
              isLoading={gabarito.isPending}
              onClick={() =>
                gabarito.mutate({
                  blocoId: bloco.id,
                  liberado: !gabaritoLiberado,
                })
              }
            >
              {gabaritoLiberado ? "Ocultar gabarito" : "Liberar gabarito"}
            </CustomButton>
          )}
        </HStack>
      )}

      {publicado && (tipo === "simulado" || tipo === "resumo") && (
        <Box
          bg="green.50"
          borderWidth="1px"
          borderColor="green.200"
          borderRadius="lg"
          p="3"
          mb="3"
        >
          <Text fontSize="xs" fontWeight="semibold" color="green.800" mb="1">
            Link do {tipo === "simulado" ? "simulado" : "resumo"} para os alunos
          </Text>
          <Text fontSize="xs" color="green.700" wordBreak="break-all">
            {`${window.location.origin}/${tipo}/${bloco.id}`}
          </Text>
          {tipo === "simulado" && (
            <Text fontSize="2xs" color="green.700" mt="1">
              {gabaritoLiberado
                ? "Gabarito comentado liberado: os alunos veem a correção."
                : "Os alunos veem a nota, mas não a correção — libere o gabarito quando quiser."}
            </Text>
          )}
        </Box>
      )}

      {!gerado && (
        <Text fontSize="2xs" color="gray.400" mb="3">
          O conteúdo é gerado a partir do caso/tema, público e objetivos da
          aula. Não precisa escrever nada.
        </Text>
      )}

      {personalizando && (
        <Personalizacao
          bloco={bloco}
          tipo={tipo}
          onChange={(patch) =>
            atualizar.mutate({
              blocoId: bloco.id,
              config: { ...bloco.config, ...patch },
            })
          }
        />
      )}

      {erro && (
        <Box
          bg="red.50"
          borderWidth="1px"
          borderColor="red.200"
          borderRadius="lg"
          p="3"
          mb="3"
        >
          <Text fontSize="xs" color="red.700">
            {mensagemErro(erro)}
          </Text>
        </Box>
      )}

      {apresentacao && <PreviewSlides apresentacao={apresentacao} />}
      {simulado && <PreviewSimulado simulado={simulado} />}
      {resumo && <PreviewResumo resumo={resumo} />}

      {tipo === "simulado" && resultados.data && (
        <ResultadosSimulado dados={resultados.data} liberado={liberado} />
      )}
    </Box>
  );
}

function Personalizacao({
  bloco,
  tipo,
  onChange,
}: {
  bloco: Bloco;
  tipo: TipoMaterial;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const config = bloco.config as Record<string, unknown>;

  return (
    <Box
      bg="gray.50"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      p="3"
      mb="3"
    >
      <Text fontSize="2xs" color="gray.500" mb="2">
        Opcional — deixe em branco para a IA decidir a partir da aula.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
        {tipo === "slides" && (
          <CustomSelect
            label="Quantidade de slides"
            placeholder="A IA decide"
            value={config.nSlides ? String(config.nSlides) : ""}
            options={N_SLIDES_OPTIONS}
            onChange={(value) => onChange({ nSlides: Number(value) })}
          />
        )}
        {tipo === "simulado" && (
          <CustomSelect
            label="Quantidade de questões"
            placeholder="A IA decide"
            value={config.nQuestoes ? String(config.nQuestoes) : ""}
            options={N_QUESTOES_OPTIONS}
            onChange={(value) => onChange({ nQuestoes: Number(value) })}
          />
        )}
        <CustomInput
          label="Instruções adicionais"
          placeholder="Ex.: enfatizar diagnóstico diferencial"
          value={String(config.instrucoesExtras ?? "")}
          onChange={(value: string) => onChange({ instrucoesExtras: value })}
        />
      </SimpleGrid>
    </Box>
  );
}

function PreviewSlides({ apresentacao }: { apresentacao: Apresentacao }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p="4">
      <Flex align="center" justify="space-between" mb="3" gap="2" wrap="wrap">
        <Heading size="xs" color="gray.700">
          {apresentacao.title}
        </Heading>
        <Badge
          variant="subtle"
          colorPalette="blue"
          borderRadius="full"
          fontSize="2xs"
        >
          {apresentacao.slides.length} slides
        </Badge>
      </Flex>

      <Stack gap="2">
        {apresentacao.slides.map((slide, index) => (
          <Box
            key={`${index}-${slide.title}`}
            borderWidth="1px"
            borderColor="gray.100"
            borderRadius="md"
            p="2.5"
          >
            <Flex gap="2" align="baseline">
              <Text fontSize="2xs" color="gray.400" minW="18px">
                {index + 1}
              </Text>
              <Box minW="0" flex="1">
                <Text fontWeight="semibold" fontSize="sm" color="gray.900">
                  {slide.title}
                </Text>
                {slide.content.length > 0 && (
                  <Stack gap="0.5" mt="1">
                    {slide.content.map((bullet, i) => (
                      <Text key={i} fontSize="xs" color="gray.600">
                        • {bullet}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Box>
            </Flex>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function PreviewSimulado({ simulado }: { simulado: SimuladoGerado }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p="4">
      <Flex align="center" justify="space-between" mb="3" gap="2" wrap="wrap">
        <Heading size="xs" color="gray.700">
          {simulado.title}
        </Heading>
        <Badge
          variant="subtle"
          colorPalette="green"
          borderRadius="full"
          fontSize="2xs"
        >
          {simulado.questions.length}{" "}
          {simulado.questions.length === 1 ? "questão" : "questões"}
        </Badge>
      </Flex>

      <Stack gap="3">
        {simulado.questions.map((questao, index) => (
          <Box
            key={index}
            borderWidth="1px"
            borderColor="gray.100"
            borderRadius="md"
            p="3"
          >
            <Text fontWeight="semibold" fontSize="sm" color="gray.900" mb="2">
              {index + 1}. {questao.statement}
            </Text>
            <Stack gap="1">
              {questao.alternatives.map((alt) => (
                <Flex key={alt.label} gap="2" align="flex-start">
                  <Flex
                    w="16px"
                    h="16px"
                    flexShrink={0}
                    mt="0.5"
                    align="center"
                    justify="center"
                    borderRadius="sm"
                    borderWidth="1px"
                    borderColor={alt.isCorrect ? "green.500" : "gray.300"}
                    bg={alt.isCorrect ? "green.500" : "white"}
                  >
                    {alt.isCorrect && (
                      <Check size={10} color="white" strokeWidth={3} />
                    )}
                  </Flex>
                  <Text
                    fontSize="xs"
                    color={alt.isCorrect ? "gray.900" : "gray.600"}
                  >
                    <b>{alt.label})</b> {alt.text}
                  </Text>
                </Flex>
              ))}
            </Stack>
            <Text fontSize="2xs" color="green.700" mt="2">
              {questao.explanationCorrect}
            </Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function PreviewResumo({ resumo }: { resumo: ResumoGerado }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="lg" p="4">
      <Heading size="xs" color="gray.700" mb="2">
        {resumo.title}
      </Heading>
      <Text fontSize="xs" color="gray.600" mb="3">
        {resumo.introduction}
      </Text>
      <Stack gap="2">
        {resumo.sections.map((secao, index) => (
          <Box key={index}>
            <Text fontWeight="semibold" fontSize="sm" color="gray.800">
              {secao.heading}
            </Text>
            {secao.paragraphs.map((paragrafo, i) => (
              <Text key={i} fontSize="xs" color="gray.600" mt="0.5">
                {paragrafo}
              </Text>
            ))}
            {secao.callout && (
              <Box
                mt="1.5"
                bg="cyan.50"
                borderLeftWidth="3px"
                borderColor="cyan.400"
                borderRadius="sm"
                px="2.5"
                py="1.5"
              >
                <Text fontSize="2xs" color="gray.700" fontStyle="italic">
                  {secao.callout}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function ResultadosSimulado({
  dados,
  liberado,
}: {
  dados: {
    totalRespondentes: number;
    mediaPercentual: number;
    tentativas: {
      usuarioId: string;
      nome: string | null;
      acertos: number;
      total: number;
      percentual: number;
    }[];
  };
  liberado: boolean;
}) {
  if (dados.totalRespondentes === 0) {
    return (
      <Text fontSize="2xs" color="gray.400" mt="3">
        {liberado
          ? "Aguardando respostas da turma…"
          : "Nenhuma resposta ainda. Libere o simulado para a turma."}
      </Text>
    );
  }

  return (
    <Box
      mt="3"
      bg="blue.50"
      borderWidth="1px"
      borderColor="blue.200"
      borderRadius="lg"
      p="3"
    >
      <Flex align="center" gap="2" mb="2">
        <Users size={14} color="#2B6CB0" />
        <Text fontSize="sm" fontWeight="semibold" color="blue.900">
          {dados.totalRespondentes}{" "}
          {dados.totalRespondentes === 1 ? "resposta" : "respostas"} · média{" "}
          {dados.mediaPercentual}%
        </Text>
      </Flex>
      <Stack gap="1">
        {dados.tentativas.slice(0, 8).map((t) => (
          <Flex key={t.usuarioId} justify="space-between" gap="2">
            <Text fontSize="xs" color="blue.800" truncate>
              {t.nome ?? `Aluno ${t.usuarioId}`}
            </Text>
            <Text fontSize="xs" color="blue.900" fontWeight="medium">
              {t.acertos}/{t.total} ({t.percentual}%)
            </Text>
          </Flex>
        ))}
      </Stack>
    </Box>
  );
}

function mensagemErro(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
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
