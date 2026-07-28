import { Box, Flex, Text } from "@cursosactive/p360-new-ui";

import type { FaixaDistribuicao } from "@/services/metricas";

/**
 * Paleta validada (skill de dataviz) — não a paleta padrão do Chakra, pra
 * garantir a separação de cor correta (CVD/contraste já verificados com o
 * script de validação, ver skill `dataviz`).
 */
export const CORES = {
  simulado: "#2a78d6", // categórico slot 1 (azul)
  enquete: "#eb6834", // categórico slot 2 (laranja)
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  trilha: "#e1e0d9",
} as const;

/** Cor por severidade — usada quando o valor representa "quão bem foi", não uma série. */
export function corPorPct(pct: number): string {
  if (pct >= 70) return CORES.good;
  if (pct >= 50) return CORES.warning;
  return CORES.critical;
}

/**
 * Barra horizontal — mark fino (10px), ponta arredondada, rótulo de valor
 * sempre visível ao lado (nunca só a cor carrega o dado, por causa do WARN
 * de contraste de algumas cores da paleta na superfície clara).
 */
export function BarraHorizontal({
  label,
  sublabel,
  pct,
  cor,
  valorLabel,
}: {
  label: string;
  sublabel?: string;
  pct: number;
  cor: string;
  valorLabel: string;
}) {
  return (
    <Box>
      <Flex justify="space-between" align="baseline" gap="3" mb="1">
        <Text fontSize="xs" color="gray.700" truncate flex="1" minW="0">
          {label}
        </Text>
        <Text fontSize="xs" fontWeight="semibold" color="gray.800" flexShrink={0}>
          {valorLabel}
        </Text>
      </Flex>
      <Box
        h="10px"
        bg={CORES.trilha}
        borderRadius="full"
        overflow="hidden"
        title={`${label}: ${valorLabel}`}
      >
        <Box
          h="full"
          w={`${Math.max(0, Math.min(100, pct))}%`}
          bg={cor}
          borderRadius="full"
          transition="width 0.3s ease"
        />
      </Box>
      {sublabel && (
        <Text fontSize="2xs" color="gray.400" mt="0.5">
          {sublabel}
        </Text>
      )}
    </Box>
  );
}

/** Distribuição de desempenho — histograma de 4 faixas, uma cor sequencial só (magnitude). */
export function DistribuicaoChart({ faixas }: { faixas: FaixaDistribuicao[] }) {
  const max = Math.max(1, ...faixas.map((f) => f.quantidade));
  return (
    <Flex align="flex-end" gap="4" h="150px" pt="6">
      {faixas.map((f) => {
        const alturaPct = f.quantidade > 0 ? Math.max(6, (f.quantidade / max) * 100) : 0;
        return (
          <Flex
            key={f.faixa}
            direction="column"
            align="center"
            flex="1"
            h="full"
            justify="flex-end"
            title={`${f.faixa}: ${f.quantidade}`}
          >
            <Text fontSize="xs" fontWeight="semibold" color="gray.700" mb="1.5">
              {f.quantidade}
            </Text>
            <Box
              w="full"
              maxW="64px"
              bg={f.minimo >= 70 ? CORES.good : f.minimo >= 50 ? CORES.warning : CORES.critical}
              borderRadius="md"
              h={`${alturaPct}%`}
              transition="height 0.3s ease"
            />
            <Text fontSize="2xs" color="gray.500" mt="2">
              {f.faixa}
            </Text>
          </Flex>
        );
      })}
    </Flex>
  );
}

/** Legenda simples de 2 cores — nunca deixar cor sozinha carregar a identidade da série. */
export function Legenda({ itens }: { itens: { cor: string; label: string }[] }) {
  return (
    <Flex gap="4" mb="3">
      {itens.map((item) => (
        <Flex key={item.label} align="center" gap="1.5">
          <Box w="8px" h="8px" borderRadius="full" bg={item.cor} />
          <Text fontSize="xs" color="gray.600">
            {item.label}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
