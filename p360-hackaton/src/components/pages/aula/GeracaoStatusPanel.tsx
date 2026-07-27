import { Box, Flex, Heading, Spinner, Text } from "@cursosactive/p360-new-ui";
import { AlertCircle, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "./AppIcon";

export type StatusItemGeracao = "pendente" | "gerando" | "pronto" | "erro";

export interface ItemGeracao {
  id: string;
  titulo: string;
  icon: LucideIcon;
  color: string;
  status: StatusItemGeracao;
  erro?: string;
}

interface GeracaoStatusPanelProps {
  itens: ItemGeracao[];
  /** Todas as etapas terminaram (prontas ou com erro). */
  concluido: boolean;
}

/**
 * Progresso real da criação da aula — cada item reflete o andamento de
 * verdade (não é uma barra de tempo simulada): "pendente" até a chamada
 * começar, "gerando" enquanto a IA trabalha, "pronto"/"erro" no final. Uma
 * falha isolada não impede os demais nem trava a tela.
 */
export default function GeracaoStatusPanel({ itens, concluido }: GeracaoStatusPanelProps) {
  const totalErros = itens.filter((i) => i.status === "erro").length;

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p={{ base: 6, md: 10 }}
      textAlign="center"
    >
      <Heading size="md" color="gray.900" mb="1">
        {concluido ? "Aula criada!" : "Criando sua aula…"}
      </Heading>
      <Text fontSize="sm" color="gray.500" mb="6">
        {concluido
          ? totalErros > 0
            ? `Pronto, com ${totalErros} ${totalErros === 1 ? "material que" : "materiais que"} não ${totalErros === 1 ? "gerou" : "geraram"} — você pode tentar de novo no cockpit.`
            : "Tudo gerado. Te levando pra listagem…"
          : "Gerando o conteúdo de cada bloco — pode levar um minuto."}
      </Text>

      <Box maxW="420px" mx="auto" textAlign="left">
        {itens.map((item) => (
          <Flex key={item.id} align="center" gap="3" py="2.5" borderBottomWidth="1px" borderColor="gray.100">
            <AppIcon icon={item.icon} size={16} color={`${item.color}.500`} />
            <Text fontSize="sm" color="gray.800" flex="1">
              {item.titulo}
            </Text>
            <StatusIcon status={item.status} />
          </Flex>
        ))}
      </Box>

      {totalErros > 0 && (
        <Box mt="5" maxW="420px" mx="auto" textAlign="left">
          {itens
            .filter((i) => i.status === "erro" && i.erro)
            .map((i) => (
              <Text key={i.id} fontSize="xs" color="red.500" mb="1">
                <b>{i.titulo}:</b> {i.erro}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
}

function StatusIcon({ status }: { status: StatusItemGeracao }) {
  if (status === "gerando") return <Spinner size="sm" color="blue.500" />;
  if (status === "pronto") return <Check size={16} color="#16A34A" />;
  if (status === "erro") return <AlertCircle size={16} color="#DC2626" />;
  return (
    <Box w="8px" h="8px" borderRadius="full" bg="gray.300" />
  );
}
