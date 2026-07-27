import {
  Badge,
  Box,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  CustomButton,
  CustomSelect,
} from "@cursosactive/p360-new-ui";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import AppIcon from "../AppIcon";
import {
  BLOCO_META,
  BLOCOS_POS_AULA,
  BLOCOS_SESSAO,
  momentoDoTipo,
  resumoConfig,
} from "../blocoMeta";
import type { BlocoMeta } from "../blocoMeta";
import { useAulaStore } from "@/store/aulaStore";
import { useTemplates } from "@/hooks/useBlocos";
import type { BlocoDraft } from "@/store/aulaStore";
import type { TipoBloco } from "@/services/blocos";

const DIFERENCIAIS = [
  {
    emoji: "📍",
    titulo: "O caso é o centro",
    texto: "todos os materiais giram em torno do mesmo paciente.",
  },
  {
    emoji: "🔗",
    titulo: "Professor e aluno conectados",
    texto: "o briefing pré-aula gera dados reais de hipóteses da turma.",
  },
  {
    emoji: "📊",
    titulo: "Métricas reais",
    texto:
      "cada material acessado vira dado de engajamento para a instituição.",
  },
];

const N_PERGUNTAS_OPTIONS = [3, 5, 8, 10].map((n) => ({
  value: String(n),
  label: `${n} questões`,
}));

interface MateriaisTabProps {
  onNext?: () => void;
}

export default function MateriaisTab({ onNext }: MateriaisTabProps) {
  const {
    selectedCaseId,
    tema,
    blocos,
    templateId,
    addBloco,
    updateBlocoConfig,
    moveBloco,
    removeBloco,
    applyTemplateBlocos,
  } = useAulaStore();
  const { data: templates } = useTemplates();

  const temPontoDePartida = Boolean(selectedCaseId) || tema.trim().length > 0;

  const blocosSessao = blocos.filter((b) => momentoDoTipo(b.tipo) === "sessao");
  const blocosPosAula = blocos.filter(
    (b) => momentoDoTipo(b.tipo) === "pos_aula",
  );

  if (!temPontoDePartida) {
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
        <Text color="gray.500" fontSize="sm">
          Volte à etapa <b>Criar</b> e escolha um caso ou descreva um tema para
          montar a sessão.
        </Text>
      </Box>
    );
  }

  return (
    <Grid
      templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 320px" }}
      gap="5"
      alignItems="start"
    >
      {/* ---------------- Coluna principal ---------------- */}
      <Stack gap="5">
        {/* Templates */}
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="xl"
          p={{ base: 4, md: 6 }}
        >
          <Heading size="sm" color="gray.800">
            Comece de um modelo
          </Heading>
          <Text fontSize="sm" color="gray.500" mb="4">
            Um ponto de partida — depois você reordena, adiciona e remove o que
            quiser.
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="3">
            {(templates ?? []).map((template) => {
              const ativo = templateId === template.id;
              return (
                <Box
                  key={template.id}
                  as="button"
                  textAlign="left"
                  p="3"
                  borderWidth="1px"
                  borderColor={ativo ? "blue.500" : "gray.200"}
                  bg={ativo ? "blue.50" : "white"}
                  borderRadius="lg"
                  cursor="pointer"
                  transition="border-color 0.15s, background 0.15s"
                  _hover={{ borderColor: ativo ? "blue.500" : "gray.300" }}
                  onClick={() =>
                    applyTemplateBlocos(template.id, template.blocos)
                  }
                >
                  <Text fontWeight="semibold" fontSize="sm" color="gray.900">
                    {template.nome}
                  </Text>
                  <Text fontSize="xs" color="gray.500" lineHeight="1.35">
                    {template.descricao}
                  </Text>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>

        {/* Sequência ao vivo */}
        <SecaoBlocos
          titulo="Sequência da aula"
          descricao="Conduzida por você, ao vivo. A ordem é livre: caso antes dos slides, enquete no fim, como preferir."
          vazio="Nenhum bloco ainda. Escolha um modelo acima ou adicione abaixo."
          catalogo={BLOCOS_SESSAO}
          blocos={blocosSessao}
          todos={blocos}
          onAdd={addBloco}
          onMove={moveBloco}
          onRemove={removeBloco}
          onConfig={updateBlocoConfig}
        />

        {/* Fixação — o aluno faz em casa */}
        <SecaoBlocos
          titulo="Pós-aula · fixação de conteúdo"
          descricao="Não entra na sessão ao vivo: o aluno faz em casa, no próprio tempo, depois que você disponibilizar."
          vazio="Nenhum material de fixação. Adicione abaixo se quiser dar algo para depois da aula."
          catalogo={BLOCOS_POS_AULA}
          blocos={blocosPosAula}
          todos={blocos}
          onAdd={addBloco}
          onMove={moveBloco}
          onRemove={removeBloco}
          onConfig={updateBlocoConfig}
        />
      </Stack>

      {/* ---------------- Coluna lateral ---------------- */}
      <Stack gap="5">
        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="xl"
          p="5"
        >
          <Flex align="center" gap="2" mb="2">
            <AppIcon icon={CheckCircle2} size={18} color="green.500" />
            <Heading size="sm" color="gray.800">
              Resumo
            </Heading>
          </Flex>
          <Text fontSize="sm" color="gray.600" mb="3">
            {blocos.length} {blocos.length === 1 ? "bloco" : "blocos"} na
            sequência
          </Text>

          {blocos.length > 0 && (
            <HStack gap="1.5" wrap="wrap" mb="4">
              {blocos.map((bloco, index) => (
                <Badge
                  key={bloco.tempId}
                  variant="subtle"
                  colorPalette={BLOCO_META[bloco.tipo].color}
                  borderRadius="full"
                  px="2.5"
                  py="0.5"
                  fontSize="xs"
                >
                  {index + 1}. {BLOCO_META[bloco.tipo].titulo}
                </Badge>
              ))}
            </HStack>
          )}

          <Text fontSize="xs" color="gray.500" mb="4">
            Depois de <b>salvar a aula</b>, você gera o conteúdo de cada bloco e
            conduz a sessão.
          </Text>

          <CustomButton
            variant="solid"
            icon={Sparkles}
            onClick={onNext}
            disabled={blocos.length === 0}
          >
            Continuar
          </CustomButton>
        </Box>

        <Box
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="xl"
          p="5"
        >
          <Heading size="sm" color="gray.800" mb="3">
            O que torna diferente
          </Heading>
          <Stack gap="3">
            {DIFERENCIAIS.map((d) => (
              <Flex key={d.titulo} gap="2" align="flex-start">
                <Text fontSize="sm" lineHeight="1.4">
                  {d.emoji}
                </Text>
                <Text fontSize="xs" color="gray.600" lineHeight="1.5">
                  <Text as="span" fontWeight="semibold" color="gray.800">
                    {d.titulo}
                  </Text>{" "}
                  — {d.texto}
                </Text>
              </Flex>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Grid>
  );
}

interface SecaoBlocosProps {
  titulo: string;
  descricao: string;
  vazio: string;
  /** Tipos que podem ser adicionados nesta seção. */
  catalogo: BlocoMeta[];
  /** Blocos desta seção, na ordem. */
  blocos: BlocoDraft[];
  /** Lista completa — usada para saber se há um caso ANTES deste bloco. */
  todos: BlocoDraft[];
  onAdd: (tipo: TipoBloco, config?: Record<string, unknown>) => void;
  onMove: (tempId: string, direcao: -1 | 1) => void;
  onRemove: (tempId: string) => void;
  onConfig: (tempId: string, patch: Record<string, unknown>) => void;
}

/** Uma seção do builder: lista ordenável + catálogo de blocos daquele momento. */
function SecaoBlocos({
  titulo,
  descricao,
  vazio,
  catalogo,
  blocos,
  todos,
  onAdd,
  onMove,
  onRemove,
  onConfig,
}: SecaoBlocosProps) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p={{ base: 4, md: 6 }}
    >
      <Heading size="sm" color="gray.800">
        {titulo}
      </Heading>
      <Text fontSize="sm" color="gray.500" mb="4">
        {descricao}
      </Text>

      {blocos.length === 0 ? (
        <Box
          borderWidth="1px"
          borderColor="gray.200"
          borderStyle="dashed"
          borderRadius="lg"
          p="6"
          textAlign="center"
          mb="4"
        >
          <Text fontSize="sm" color="gray.500">
            {vazio}
          </Text>
        </Box>
      ) : (
        <Stack gap="3" mb="5">
          {blocos.map((bloco, index) => (
            <BlocoItem
              key={bloco.tempId}
              bloco={bloco}
              posicao={index + 1}
              primeiro={index === 0}
              ultimo={index === blocos.length - 1}
              temCasoAntes={todos
                .slice(
                  0,
                  todos.findIndex((b) => b.tempId === bloco.tempId),
                )
                .some((b) => b.tipo === "caso")}
              onMove={(direcao) => onMove(bloco.tempId, direcao)}
              onRemove={() => onRemove(bloco.tempId)}
              onConfig={(patch) => onConfig(bloco.tempId, patch)}
            />
          ))}
        </Stack>
      )}

      <Text
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="wide"
        textTransform="uppercase"
        color="gray.400"
        mb="2"
      >
        Adicionar
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
        {catalogo.map((meta) => (
          <Flex
            key={meta.tipo}
            as={meta.enabled ? "button" : "div"}
            align="flex-start"
            gap="3"
            p="3"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="lg"
            textAlign="left"
            cursor={meta.enabled ? "pointer" : "not-allowed"}
            opacity={meta.enabled ? 1 : 0.5}
            transition="border-color 0.15s"
            _hover={meta.enabled ? { borderColor: "gray.300" } : undefined}
            onClick={
              meta.enabled
                ? () =>
                    onAdd(
                      meta.tipo,
                      meta.tipo === "enquete"
                        ? { foco: "geral", nPerguntas: 5 }
                        : {},
                    )
                : undefined
            }
          >
            <AppIcon icon={meta.icon} size={18} color={`${meta.color}.500`} />
            <Box minW="0" flex="1">
              <Flex align="center" gap="2">
                <Text fontWeight="semibold" fontSize="sm" color="gray.900">
                  {meta.titulo}
                </Text>
                {!meta.enabled && (
                  <Badge
                    variant="subtle"
                    colorPalette="gray"
                    borderRadius="full"
                    fontSize="2xs"
                  >
                    em breve
                  </Badge>
                )}
              </Flex>
              <Text fontSize="xs" color="gray.500" lineHeight="1.35">
                {meta.descricao}
              </Text>
            </Box>
            {meta.enabled && <AppIcon icon={Plus} size={16} color="gray.400" />}
          </Flex>
        ))}
      </SimpleGrid>
    </Box>
  );
}

interface BlocoItemProps {
  bloco: BlocoDraft;
  posicao: number;
  primeiro: boolean;
  ultimo: boolean;
  /** Habilita o foco "pontos fracos" — precisa de um caso ANTES na sequência. */
  temCasoAntes: boolean;
  onMove: (direcao: -1 | 1) => void;
  onRemove: () => void;
  onConfig: (patch: Record<string, unknown>) => void;
}

function BlocoItem({
  bloco,
  posicao,
  primeiro,
  ultimo,
  temCasoAntes,
  onMove,
  onRemove,
  onConfig,
}: BlocoItemProps) {
  const meta = BLOCO_META[bloco.tipo as TipoBloco];
  const resumo = resumoConfig(bloco.tipo, bloco.config);

  const focoOptions = [
    { value: "geral", label: "Foco geral no tema" },
    {
      value: "fraquezas",
      label: temCasoAntes
        ? "Focar nos pontos fracos da turma"
        : "Pontos fracos (exige um caso antes)",
    },
  ];

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      p="3"
      bg="white"
    >
      <Flex align="flex-start" gap="3">
        <Flex
          w="24px"
          h="24px"
          flexShrink={0}
          align="center"
          justify="center"
          borderRadius="full"
          bg="gray.100"
          color="gray.600"
          fontSize="xs"
          fontWeight="semibold"
        >
          {posicao}
        </Flex>
        <AppIcon icon={meta.icon} size={18} color={`${meta.color}.500`} />

        <Box minW="0" flex="1">
          <Text fontWeight="semibold" fontSize="sm" color="gray.900">
            {meta.titulo}
          </Text>
          <Text fontSize="xs" color="gray.500" lineHeight="1.35">
            {resumo ?? meta.descricao}
          </Text>
        </Box>

        <HStack gap="1">
          <IconAction
            label="Mover para cima"
            icon={ArrowUp}
            disabled={primeiro}
            onClick={() => onMove(-1)}
          />
          <IconAction
            label="Mover para baixo"
            icon={ArrowDown}
            disabled={ultimo}
            onClick={() => onMove(1)}
          />
          <IconAction label="Remover" icon={Trash2} onClick={onRemove} danger />
        </HStack>
      </Flex>

      {/* Config específica da enquete */}
      {bloco.tipo === "enquete" && (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" mt="3" pl="12">
          <CustomSelect
            label="Foco das questões"
            placeholder="Selecione"
            value={
              bloco.config.foco === "fraquezas" && temCasoAntes
                ? "fraquezas"
                : "geral"
            }
            options={focoOptions}
            onChange={(value) =>
              onConfig({
                foco:
                  value === "fraquezas" && temCasoAntes ? "fraquezas" : "geral",
              })
            }
          />
          <CustomSelect
            label="Quantidade"
            placeholder="Selecione"
            value={String(bloco.config.nPerguntas ?? 5)}
            options={N_PERGUNTAS_OPTIONS}
            onChange={(value) => onConfig({ nPerguntas: Number(value) })}
          />
        </SimpleGrid>
      )}
    </Box>
  );
}

interface IconActionProps {
  label: string;
  icon: typeof ArrowUp;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function IconAction({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: IconActionProps) {
  return (
    <Flex
      as="button"
      aria-label={label}
      title={label}
      align="center"
      justify="center"
      w="28px"
      h="28px"
      borderRadius="md"
      borderWidth="1px"
      borderColor="gray.200"
      color={danger ? "red.500" : "gray.500"}
      bg="white"
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.4 : 1}
      _hover={disabled ? undefined : { bg: danger ? "red.50" : "gray.50" }}
      onClick={disabled ? undefined : onClick}
    >
      <AppIcon icon={icon} size={14} />
    </Flex>
  );
}
