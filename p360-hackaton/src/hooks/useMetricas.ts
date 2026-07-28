import { useQuery } from "@tanstack/react-query";

import { getMetricasDetalhadas } from "@/services/metricas";

export function useMetricasDetalhadas() {
  return useQuery({
    queryKey: ["metricas", "detalhado"],
    queryFn: getMetricasDetalhadas,
    staleTime: 30_000,
  });
}
