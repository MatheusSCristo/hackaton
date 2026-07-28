import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Box, Flex, Heading, Tabs, Text } from "@cursosactive/p360-new-ui";
import { ArrowLeft, Files, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "./AppIcon";
import { BLOCO_META } from "./blocoMeta";
import GeracaoStatusPanel from "./GeracaoStatusPanel";
import type { ItemGeracao } from "./GeracaoStatusPanel";
import CriarTab from "./tabs/CriarTab";
import MateriaisTab from "./tabs/MateriaisTab";
import { useCriarAula } from "@/hooks/useAulas";
import { useValidacaoEtapaCriar } from "@/hooks/useValidacaoEtapaCriar";
import { useAulaStore } from "@/store/aulaStore";
import { prepararCaso } from "@/services/caso";
import { gerarEnquete } from "@/services/enquete";
import { gerarMaterial } from "@/services/materiais";
import type { TipoBloco } from "@/services/blocos";
import { mensagemErro } from "@/utils/erro";

/** Tipos que geram conteúdo sozinhos, sem passo extra — disparados de uma vez. */
const TIPOS_COM_GERACAO: readonly TipoBloco[] = [
  "slides",
  "simulado",
  "resumo",
  "material_complementar",
  "enquete",
];
/** + "caso": não gera conteúdo, mas também dispara sozinho (o preparo no
 * legado) assim que a aula é criada — turma/modo já vieram da config do
 * bloco (etapa Materiais). */
const TIPOS_COM_ACAO_AUTOMATICA: readonly TipoBloco[] = [
  ...TIPOS_COM_GERACAO,
  "caso",
];

interface TabDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { value: "criar", label: "1. Criar", icon: Wand2 },
  { value: "materiais", label: "2. Materiais", icon: Files },
];

export default function AulaConectadaPage() {
  const [tab, setTab] = useState("criar");
  const [gerandoTudo, setGerandoTudo] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [itensGeracao, setItensGeracao] = useState<ItemGeracao[]>([]);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);
  const [mostrarErrosCriar, setMostrarErrosCriar] = useState(false);
  const navigate = useNavigate();
  const criar = useCriarAula();
  const validacaoCriar = useValidacaoEtapaCriar();
  const {
    mode,
    selectedCaseId,
    selectedCaseTitulo,
    tema,
    publico,
    duracao,
    objetivos,
    blocos,
    reset,
  } = useAulaStore();

  // A store é global e sobrevive à navegação — sem isso, sair desta tela e
  // voltar mostraria o rascunho da última vez em vez de um formulário limpo.
  useEffect(() => {
    reset();
    setTab("criar");
    setMostrarErrosCriar(false);
    // Só ao montar a tela — resetar a cada render apagaria o que o professor
    // acabou de digitar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Só avança pra aba Materiais se os campos obrigatórios da etapa Criar
   * estiverem preenchidos — usado tanto pelo botão "Próxima etapa" quanto
   * pelo clique direto na aba, pra não dar pra pular a validação clicando
   * na aba "2. Materiais" direto.
   */
  const tentarIrParaMateriais = () => {
    if (!validacaoCriar.valido) {
      setMostrarErrosCriar(true);
      return;
    }
    setMostrarErrosCriar(false);
    setTab("materiais");
  };

  const montarPayload = () => ({
    modo: mode,
    casoLegacyId: selectedCaseId ? Number(selectedCaseId) : undefined,
    casoTitulo: selectedCaseTitulo ?? undefined,
    tema: tema.trim() || undefined,
    publico: publico || undefined,
    duracao: duracao || undefined,
    objetivos: objetivos || undefined,
    // A ordem do array é a ordem da sessão.
    blocos: blocos.map((bloco) => ({
      tipo: bloco.tipo,
      config: bloco.config,
    })),
  });

  /**
   * Ação principal da aba Materiais: salva a aula E já dispara, em paralelo,
   * a geração de todo o conteúdo (slides, simulado, resumo, material
   * complementar, rascunho de enquete) E o preparo do caso clínico no legado
   * (quando houver bloco `caso`, com a turma já escolhida na etapa Criar) —
   * o professor vê o progresso real na mesma tela, em vez de precisar clicar
   * "gerar"/"preparar" bloco a bloco depois. Falha isolada de 1 bloco não
   * trava os demais nem impede os outros de completarem.
   */
  const handleCriarEGerarTudo = async () => {
    const draftAntesDeCriar = blocos;

    setErroCriacao(null);
    setItensGeracao(
      draftAntesDeCriar
        .filter((b) => TIPOS_COM_ACAO_AUTOMATICA.includes(b.tipo))
        .map((b) => ({
          id: b.tempId,
          titulo: BLOCO_META[b.tipo].titulo,
          icon: BLOCO_META[b.tipo].icon,
          color: BLOCO_META[b.tipo].color,
          status: "pendente" as const,
        })),
    );
    setConcluido(false);
    setGerandoTudo(true);

    try {
      const aula = await criar.mutateAsync(montarPayload());
      reset();

      const paresPorOrdem = draftAntesDeCriar.map((local, index) => ({
        local,
        real: aula.blocos?.[index],
      }));

      await Promise.allSettled(
        paresPorOrdem.map(async ({ local, real }) => {
          if (!real || !TIPOS_COM_ACAO_AUTOMATICA.includes(local.tipo)) return;

          setItensGeracao((prev) =>
            prev.map((it) => (it.id === local.tempId ? { ...it, status: "gerando" } : it)),
          );
          try {
            if (local.tipo === "enquete") {
              await gerarEnquete(aula.id, real.id, {});
            } else if (local.tipo === "caso") {
              // Turma/modo já foram gravados no `config` do bloco (etapa
              // Materiais) — preparar só cria/atribui o acesso no legado.
              await prepararCaso(aula.id, real.id);
            } else {
              await gerarMaterial(aula.id, real.id);
            }
            setItensGeracao((prev) =>
              prev.map((it) => (it.id === local.tempId ? { ...it, status: "pronto" } : it)),
            );
          } catch (error) {
            setItensGeracao((prev) =>
              prev.map((it) =>
                it.id === local.tempId
                  ? { ...it, status: "erro", erro: mensagemErro(error) }
                  : it,
              ),
            );
          }
        }),
      );

      setConcluido(true);
      // Pequena pausa pro professor ver o resultado final antes de sair da tela.
      await new Promise((resolve) => setTimeout(resolve, 1600));
      navigate("/");
    } catch (error) {
      // Falha em criar a própria aula (não em gerar um material) — aqui sim
      // interrompe, não há aula pra continuar preenchendo. Volta pro
      // formulário com o erro visível, em vez de deixar a tela de loading
      // travada ou estourar uma exceção não tratada.
      setGerandoTudo(false);
      setErroCriacao(mensagemErro(error));
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Tabs.Root
        value={tab}
        onValueChange={(e) => {
          // Clicar direto na aba "Materiais" passa pela mesma validação do
          // botão "Próxima etapa" — não dá pra pular preenchendo nada.
          if (e.value === "materiais") {
            tentarIrParaMateriais();
            return;
          }
          setTab(e.value);
        }}
        variant="line"
      >
        {/* Cabeçalho + abas sobre fundo branco */}
        <Box bg="white">
          <Flex
            justify="space-between"
            align="flex-start"
            gap="4"
            wrap="wrap"
            px={{ base: 4, md: 8 }}
            pt="5"
            pb="4"
          >
            <Box>
              <Flex
                as="button"
                align="center"
                gap="1"
                mb="1"
                color="gray.500"
                cursor="pointer"
                _hover={{ color: "gray.700" }}
                onClick={() => navigate("/")}
              >
                <AppIcon icon={ArrowLeft} size={14} />
                <Text fontSize="sm">Voltar</Text>
              </Flex>
              <Heading size="lg" color="gray.900">
                Aula conectada
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Professor e aluno no mesmo caso. Dados que mostram resultado.
              </Text>
            </Box>
          </Flex>

          <Tabs.List px={{ base: 2, md: 6 }}>
            {TABS.map((t) => (
              <Tabs.Trigger key={t.value} value={t.value}>
                <Flex align="center" gap="2">
                  <AppIcon icon={t.icon} size={16} />
                  {t.label}
                </Flex>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Box>

        {/* Conteúdo sobre fundo cinza */}
        <Box px={{ base: 4, md: 8 }} py="6">
          <Tabs.Content value="criar">
            <CriarTab
              onNext={tentarIrParaMateriais}
              mostrarErros={mostrarErrosCriar}
            />
          </Tabs.Content>
          <Tabs.Content value="materiais">
            {gerandoTudo ? (
              <GeracaoStatusPanel itens={itensGeracao} concluido={concluido} />
            ) : (
              <>
                {erroCriacao && (
                  <Box
                    bg="red.50"
                    borderWidth="1px"
                    borderColor="red.200"
                    borderRadius="lg"
                    p="3"
                    mb="4"
                  >
                    <Text fontSize="sm" color="red.700">
                      Não foi possível criar a aula: {erroCriacao}
                    </Text>
                  </Box>
                )}
                <MateriaisTab onCriarEGerarTudo={handleCriarEGerarTudo} />
              </>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}
