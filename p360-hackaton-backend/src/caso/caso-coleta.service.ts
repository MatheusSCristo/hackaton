import { Injectable } from "@nestjs/common";

import { LegacyDbService } from "../legacy-db/legacy-db.service";

/**
 * Etapas do raciocínio clínico, derivadas dos eventos que o player emite.
 * Espelha o racional do `relatorio.js` do legado (presença de evento = feito).
 */
const ETAPAS: { chave: string; label: string; eventos: string[] }[] = [
  {
    chave: "anamnese",
    label: "Anamnese",
    eventos: ["anamnese_play", "anamnese_end"],
  },
  {
    chave: "examefisico",
    label: "Exame físico",
    eventos: ["examefisico_play", "examefisico_end"],
  },
  { chave: "exames", label: "Exames", eventos: ["exame_play", "exame_end"] },
  {
    chave: "diagnostico",
    label: "Diagnóstico",
    eventos: ["diagnostico_end", "hipotese_end"],
  },
  { chave: "conduta", label: "Conduta", eventos: ["conduta_end"] },
];

const EVENTOS_CONCLUSAO = ["caso_end", "exit"];

export interface EtapaAgregada {
  chave: string;
  label: string;
  alunos: number;
  porcentagem: number;
}

export interface AgregadoCaso {
  alunosTotal: number;
  alunosEngajados: number;
  concluidos: number;
  taxaConclusao: number;
  engajamento: number;
  etapas: EtapaAgregada[];
  /** Tempo médio por etapa, em segundos (de `casotime`). */
  tempos: { evento: string; segundos: number }[];
}

/**
 * Coleta o desempenho **depois** da execução — não é tempo real.
 *
 * Fonte primária: `caseevent`, a única tabela de log que carrega `class_id`
 * (turma), o que permite recortar exatamente a janela da sessão.
 */
@Injectable()
export class CasoColetaService {
  constructor(private readonly read: LegacyDbService) {}

  async agregar(params: {
    turmaId: number;
    casoLegacyId: number;
    inicio: Date;
    fim: Date;
    conectados: number;
  }): Promise<AgregadoCaso> {
    const { turmaId, casoLegacyId, inicio, fim, conectados } = params;

    const [eventos, tempos] = await Promise.all([
      this.read.query<{ usuario_id: number; evento: string }>(
        `SELECT DISTINCT usuario_id, evento
           FROM caseevent
          WHERE class_id = $1
            AND caso_id = $2
            AND createdat BETWEEN $3 AND $4`,
        [turmaId, casoLegacyId, inicio, fim],
      ),
      this.read.query<{ evento: string; segundos: string | null }>(
        `SELECT ct.evento,
                AVG(EXTRACT(EPOCH FROM ct.tempo))::text AS segundos
           FROM casotime ct
           JOIN turmausuario tu ON tu.usu_id = ct.usuario_id
          WHERE tu.tma_id = $1 AND ct.caso_id = $2
          GROUP BY ct.evento`,
        [turmaId, casoLegacyId],
      ),
    ]);

    // Denominador é quem estava CONECTADO na sala, não o total matriculado
    // na turma no legado — não reflete quem realmente participou da sessão.
    const alunosTotal = conectados;

    const porEvento = new Map<string, Set<number>>();
    const engajados = new Set<number>();
    for (const linha of eventos) {
      engajados.add(linha.usuario_id);
      const set = porEvento.get(linha.evento) ?? new Set<number>();
      set.add(linha.usuario_id);
      porEvento.set(linha.evento, set);
    }

    const contarAlunos = (nomes: string[]): number => {
      const conjunto = new Set<number>();
      for (const nome of nomes) {
        for (const id of porEvento.get(nome) ?? []) conjunto.add(id);
      }
      return conjunto.size;
    };

    const pct = (parte: number): number =>
      alunosTotal > 0 ? Math.round((100 * parte) / alunosTotal) : 0;

    const concluidos = contarAlunos(EVENTOS_CONCLUSAO);

    return {
      alunosTotal,
      alunosEngajados: engajados.size,
      concluidos,
      taxaConclusao: pct(concluidos),
      engajamento: pct(engajados.size),
      etapas: ETAPAS.map((etapa) => {
        const alunosEtapa = contarAlunos(etapa.eventos);
        return {
          chave: etapa.chave,
          label: etapa.label,
          alunos: alunosEtapa,
          porcentagem: pct(alunosEtapa),
        };
      }),
      tempos: tempos
        .filter((t) => t.segundos !== null)
        .map((t) => ({
          evento: t.evento,
          segundos: Math.round(Number(t.segundos)),
        })),
    };
  }

  /**
   * Contador "X de Y concluíram", para o professor decidir quando encerrar.
   * Consulta leve — chamada periodicamente, não é stream de progresso.
   *
   * `alunosTotal` é quem está **conectado na sala agora** (não o total
   * matriculado na turma no legado — não reflete quem realmente está
   * presente). `iniciaram` fica sempre 0 por enquanto: o evento de "começou"
   * do legado não é confiável o bastante pra mostrar ainda.
   */
  async progresso(params: {
    turmaId: number;
    casoLegacyId: number;
    inicio: Date;
    fim: Date;
    conectados: number;
  }): Promise<{ concluidos: number; iniciaram: number; alunosTotal: number }> {
    const { turmaId, casoLegacyId, inicio, fim, conectados } = params;

    const contagem = await this.read.query<{ concluidos: string }>(
      `SELECT COUNT(DISTINCT usuario_id) FILTER (WHERE evento = ANY($5))::text
             AS concluidos
         FROM caseevent
        WHERE class_id = $1
          AND caso_id = $2
          AND createdat BETWEEN $3 AND $4`,
      [turmaId, casoLegacyId, inicio, fim, EVENTOS_CONCLUSAO],
    );

    return {
      alunosTotal: conectados,
      concluidos: Number(contagem[0]?.concluidos ?? 0),
      iniciaram: 0,
    };
  }
}
