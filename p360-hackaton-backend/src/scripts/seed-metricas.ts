/**
 * Popula a base de demonstração de ponta a ponta, amarrada a **uma empresa**:
 * turma e alunos no legado, aulas com caso clínico executado, simulados
 * respondidos e enquetes votadas no nosso banco.
 *
 * Por que existe: as métricas leem `SimuladoTentativa`/`EnqueteResultado` (ver
 * `MetricasService`) e o painel do caso lê `caseevent` do legado — tudo isso só
 * nasce de aluno respondendo de verdade. Numa base nova as telas ficam zeradas e
 * não dá para avaliar layout nem insights.
 *
 * O que ele escreve no **legado** (`avp`), e por quê: sem turma e sem aluno
 * matriculado, os números do nosso banco ficariam soltos de qualquer turma real
 * e o caso clínico não coletaria nada. Só INSERT, tudo marcado com
 * `external_id`, e `--limpar` remove exatamente o que criou — detalhes em
 * `seed-legado.ts`.
 *
 * **Não chama IA**: o conteúdo dos simulados e enquetes é fixo, escrito aqui.
 * Por isso o bloco de caso sai com o agregado da turma mas **sem** o diagnóstico
 * textual — esse é gerado por IA, e o professor pode produzi-lo clicando em
 * coletar de novo.
 *
 * Uso (dentro do container, onde o Prisma Client está gerado):
 *
 *   docker compose exec app node dist/scripts/seed-metricas.js --empresa=685
 *   docker compose exec app node dist/scripts/seed-metricas.js --empresa="Uni - Hackaton" --alunos=28
 *   docker compose exec app node dist/scripts/seed-metricas.js --empresa=685 --limpar
 */
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { SeedLegado } from "./seed-legado";
import type { AlunoLegado } from "./seed-legado";

const prisma = new PrismaClient();

/** Marca de origem. `--limpar` só apaga aula cujos blocos tenham esta marca. */
const SEED_TAG = "seed-metricas";

const PADRAO = {
  professor: "82502",
  /** Id ou trecho do nome da empresa. */
  empresa: "Uni - Hackaton",
  turma: "Turma Demo — Aula Conectada",
  aulas: 5,
  alunos: 24,
  dominio: "demo.paciente360.local",
};

// --------------------------------------------------------------- argumentos

interface Opcoes {
  professor: string;
  empresa: string;
  turma: string;
  aulas: number;
  alunos: number;
  limpar: boolean;
}

function lerOpcoes(argv: string[]): Opcoes {
  const get = (nome: string): string | undefined => {
    const item = argv.find((a) => a.startsWith(`--${nome}=`));
    return item?.slice(nome.length + 3);
  };
  const inteiro = (nome: string, padrao: number): number => {
    const bruto = get(nome);
    if (bruto === undefined) return padrao;
    const n = Number(bruto);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`--${nome} precisa ser um inteiro positivo (recebi "${bruto}").`);
    }
    return n;
  };

  return {
    professor: get("professor") ?? PADRAO.professor,
    empresa: get("empresa") ?? PADRAO.empresa,
    turma: get("turma") ?? PADRAO.turma,
    aulas: inteiro("aulas", PADRAO.aulas),
    alunos: inteiro("alunos", PADRAO.alunos),
    limpar: argv.includes("--limpar"),
  };
}

// ------------------------------------------------------------- aleatoriedade

/**
 * PRNG determinístico (mulberry32).
 *
 * Rodar duas vezes com os mesmos argumentos precisa dar os mesmos números:
 * senão é impossível dizer se um valor estranho na tela é bug de cálculo ou
 * sorteio novo.
 */
function prng(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = prng(20260728);

const inteiroEntre = (min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1));

const sorteia = <T>(itens: T[]): T => itens[Math.floor(rand() * itens.length)];

/** Gira a lista: usado para variar QUEM falta em cada aula, sem perder ninguém. */
function rotacionar<T>(itens: T[], deslocamento: number): T[] {
  if (itens.length === 0) return itens;
  const n = deslocamento % itens.length;
  return [...itens.slice(n), ...itens.slice(0, n)];
}

// ------------------------------------------------------------------ conteúdo

interface Questao {
  statement: string;
  alternatives: { label: string; text: string; isCorrect: boolean }[];
  explanationCorrect: string;
}

interface TemaDemo {
  titulo: string;
  tema: string;
  publico: string;
  objetivos: string;
  questoes: Questao[];
  enquete: { enunciado: string; opcoes: { texto: string; correta: boolean }[] }[];
}

/** Alternativas em formato A/B/C/D marcando a correta pelo índice. */
function alternativas(
  textos: string[],
  correta: number,
): Questao["alternatives"] {
  return textos.map((text, i) => ({
    label: String.fromCharCode(65 + i),
    text,
    isCorrect: i === correta,
  }));
}

const TEMAS: TemaDemo[] = [
  {
    titulo: "Insuficiência cardíaca descompensada",
    tema: "Insuficiência cardíaca",
    publico: "Internato — 6º ano de Medicina",
    objetivos:
      "Reconhecer perfis hemodinâmicos, indicar o tratamento inicial e identificar sinais de gravidade.",
    questoes: [
      {
        statement:
          "Paciente com dispneia progressiva, estertores bibasais e turgência jugular. Qual o perfil hemodinâmico mais provável?",
        alternatives: alternativas(
          [
            "Quente e congesto (B)",
            "Frio e seco (L)",
            "Quente e seco (A)",
            "Frio e congesto (C)",
          ],
          0,
        ),
        explanationCorrect:
          "Congestão sem sinais de má perfusão caracteriza o perfil B, o mais comum na descompensação.",
      },
      {
        statement:
          "Qual a primeira medida farmacológica no perfil congesto com pressão arterial preservada?",
        alternatives: alternativas(
          [
            "Diurético de alça intravenoso",
            "Dobutamina em infusão contínua",
            "Expansão volêmica com cristaloide",
            "Betabloqueador em dose plena",
          ],
          0,
        ),
        explanationCorrect:
          "Descongestionar vem primeiro; inotrópico só entra se houver má perfusão.",
      },
      {
        statement:
          "Qual achado laboratorial ajuda mais a diferenciar dispneia cardiogênica de pulmonar?",
        alternatives: alternativas(
          ["BNP / NT-proBNP", "Dímero-D", "Procalcitonina", "CK-MB"],
          0,
        ),
        explanationCorrect:
          "BNP/NT-proBNP tem bom valor preditivo negativo para causa cardiogênica.",
      },
      {
        statement:
          "Em qual situação o betabloqueador deve ser suspenso na descompensação?",
        alternatives: alternativas(
          [
            "Choque cardiogênico ou necessidade de inotrópico",
            "Qualquer internação por descompensação",
            "Sempre que houver congestão pulmonar",
            "Quando a fração de ejeção for menor que 40%",
          ],
          0,
        ),
        explanationCorrect:
          "Fora do baixo débito, o betabloqueador deve ser mantido — suspender piora o prognóstico.",
      },
      {
        statement: "Qual medicamento reduz mortalidade na IC com fração de ejeção reduzida?",
        alternatives: alternativas(
          [
            "Inibidor de SGLT2",
            "Digoxina",
            "Furosemida",
            "Amiodarona",
          ],
          0,
        ),
        explanationCorrect:
          "Diuréticos aliviam sintomas; os inibidores de SGLT2 reduzem mortalidade e internação.",
      },
    ],
    enquete: [
      {
        enunciado: "Diante de congestão com PA normal, sua primeira conduta é:",
        opcoes: [
          { texto: "Diurético IV", correta: true },
          { texto: "Inotrópico", correta: false },
          { texto: "Volume", correta: false },
        ],
      },
      {
        enunciado: "Qual sinal indica má perfusão periférica?",
        opcoes: [
          { texto: "Extremidades frias e pulso filiforme", correta: true },
          { texto: "Estertores bibasais", correta: false },
          { texto: "Turgência jugular", correta: false },
        ],
      },
    ],
  },
  {
    titulo: "Sepse e choque séptico",
    tema: "Sepse",
    publico: "Internato — 5º ano de Medicina",
    objetivos:
      "Aplicar o pacote da primeira hora, reconhecer disfunção orgânica e evitar atraso no antibiótico.",
    questoes: [
      {
        statement: "Qual o alvo de PAM na ressuscitação inicial do choque séptico?",
        alternatives: alternativas(
          ["≥ 65 mmHg", "≥ 50 mmHg", "≥ 90 mmHg", "≥ 100 mmHg"],
          0,
        ),
        explanationCorrect: "PAM ≥ 65 mmHg é o alvo inicial recomendado.",
      },
      {
        statement: "Em quanto tempo o antibiótico deve ser administrado?",
        alternatives: alternativas(
          ["Na primeira hora", "Em até 6 horas", "Após o resultado da cultura", "Em até 12 horas"],
          0,
        ),
        explanationCorrect: "Cada hora de atraso aumenta a mortalidade — colher cultura não pode atrasar a dose.",
      },
      {
        statement: "Qual vasopressor é a primeira escolha?",
        alternatives: alternativas(
          ["Noradrenalina", "Dopamina", "Adrenalina", "Vasopressina"],
          0,
        ),
        explanationCorrect: "Noradrenalina é a primeira linha; vasopressina entra como poupadora.",
      },
      {
        statement: "Qual exame define disfunção orgânica de forma mais precoce à beira do leito?",
        alternatives: alternativas(
          ["Lactato arterial", "Hemograma completo", "Radiografia de tórax", "Proteína C reativa"],
          0,
        ),
        explanationCorrect: "Lactato reflete hipoperfusão tecidual e guia a resposta à ressuscitação.",
      },
    ],
    enquete: [
      {
        enunciado: "Qual o volume inicial de cristaloide na hipoperfusão induzida por sepse?",
        opcoes: [
          { texto: "30 mL/kg", correta: true },
          { texto: "10 mL/kg", correta: false },
          { texto: "60 mL/kg", correta: false },
        ],
      },
    ],
  },
  {
    titulo: "Abordagem da dor torácica na emergência",
    tema: "Síndrome coronariana aguda",
    publico: "Internato — 6º ano de Medicina",
    objetivos:
      "Estratificar risco, interpretar o ECG inicial e decidir entre estratégia invasiva e conservadora.",
    questoes: [
      {
        statement: "Em quanto tempo o ECG deve ser realizado na suspeita de SCA?",
        alternatives: alternativas(
          ["Em até 10 minutos", "Em até 30 minutos", "Em até 1 hora", "Após a troponina"],
          0,
        ),
        explanationCorrect: "O ECG em 10 minutos é o que separa supra de não-supra e define a reperfusão.",
      },
      {
        statement: "Qual achado indica reperfusão imediata?",
        alternatives: alternativas(
          [
            "Supradesnivelamento de ST em duas derivações contíguas",
            "Inversão isolada de onda T",
            "Extrassístoles ventriculares",
            "Bloqueio de primeiro grau",
          ],
          0,
        ),
        explanationCorrect: "Supra de ST contíguo é critério de reperfusão de urgência.",
      },
      {
        statement: "Qual marcador tem melhor desempenho para descartar infarto?",
        alternatives: alternativas(
          ["Troponina ultrassensível seriada", "CK total", "Mioglobina", "LDH"],
          0,
        ),
        explanationCorrect: "A troponina ultrassensível seriada permite descarte precoce em protocolo.",
      },
      {
        statement: "Qual conduta é contraindicada no infarto de ventrículo direito com hipotensão?",
        alternatives: alternativas(
          ["Nitrato", "Volume", "Ácido acetilsalicílico", "Oxigênio se hipoxemia"],
          0,
        ),
        explanationCorrect: "Nitrato reduz a pré-carga e agrava a hipotensão no acometimento de VD.",
      },
      {
        statement: "Qual escore estratifica risco na SCA sem supra?",
        alternatives: alternativas(["GRACE", "CHA2DS2-VASc", "Wells", "CURB-65"], 0),
        explanationCorrect: "GRACE estima risco e ajuda a definir o tempo da estratégia invasiva.",
      },
      {
        statement: "Qual antiagregante compõe a dupla terapia inicial com AAS?",
        alternatives: alternativas(
          ["Clopidogrel ou ticagrelor", "Varfarina", "Heparina de baixo peso", "Rivaroxabana"],
          0,
        ),
        explanationCorrect: "A dupla antiagregação usa AAS + inibidor de P2Y12; anticoagulante é outra frente.",
      },
    ],
    enquete: [
      {
        enunciado: "Paciente com dor torácica típica e ECG normal. Qual o próximo passo?",
        opcoes: [
          { texto: "Troponina seriada", correta: true },
          { texto: "Alta com analgésico", correta: false },
          { texto: "Trombólise imediata", correta: false },
        ],
      },
      {
        enunciado: "Qual dessas dores tem MAIOR probabilidade de origem isquêmica?",
        opcoes: [
          { texto: "Opressiva, irradiando para o membro superior esquerdo", correta: true },
          { texto: "Pontual, que piora à palpação", correta: false },
          { texto: "Em queimação, relacionada à alimentação", correta: false },
        ],
      },
      {
        enunciado: "O que mais atrasa a reperfusão na prática?",
        opcoes: [
          { texto: "Tempo até o primeiro ECG", correta: true },
          { texto: "Falta de troponina", correta: false },
          { texto: "Ausência de ecocardiograma", correta: false },
        ],
      },
    ],
  },
  {
    titulo: "Cetoacidose diabética",
    tema: "Emergências endocrinológicas",
    publico: "Internato — 5º ano de Medicina",
    objetivos:
      "Diagnosticar, corrigir volemia e distúrbio eletrolítico e conduzir a insulinoterapia com segurança.",
    questoes: [
      {
        statement: "Qual a tríade diagnóstica da cetoacidose diabética?",
        alternatives: alternativas(
          [
            "Hiperglicemia, acidose metabólica e cetonemia",
            "Hiperglicemia, alcalose e cetonúria",
            "Hipoglicemia, acidose e cetonemia",
            "Hiperglicemia isolada",
          ],
          0,
        ),
        explanationCorrect: "As três precisam estar presentes — hiperglicemia isolada não fecha diagnóstico.",
      },
      {
        statement: "Quando iniciar reposição de potássio?",
        alternatives: alternativas(
          ["Quando K < 5,2 mEq/L e houver diurese", "Sempre de imediato", "Somente se K < 2,5", "Nunca na fase aguda"],
          0,
        ),
        explanationCorrect: "A insulina joga potássio para dentro da célula; repor antes evita hipocalemia grave.",
      },
      {
        statement: "Quando adicionar glicose à hidratação?",
        alternatives: alternativas(
          ["Quando a glicemia atingir cerca de 200 mg/dL", "Desde o início", "Somente após a alta", "Quando a glicemia estiver abaixo de 70"],
          0,
        ),
        explanationCorrect: "Permite manter a insulina até fechar a acidose sem provocar hipoglicemia.",
      },
      {
        statement: "Qual critério indica resolução da cetoacidose?",
        alternatives: alternativas(
          [
            "Normalização do ânion gap e do bicarbonato",
            "Glicemia menor que 200 mg/dL",
            "Cetonúria negativa isolada",
            "Melhora apenas dos sintomas",
          ],
          0,
        ),
        explanationCorrect: "O alvo é a acidose, não a glicemia — daí o gap e o bicarbonato.",
      },
    ],
    enquete: [
      {
        enunciado: "Qual é a prioridade nos primeiros minutos?",
        opcoes: [
          { texto: "Hidratação venosa", correta: true },
          { texto: "Bicarbonato", correta: false },
          { texto: "Insulina em bolus alto", correta: false },
        ],
      },
      {
        enunciado: "Bicarbonato está indicado quando:",
        opcoes: [
          { texto: "pH < 6,9", correta: true },
          { texto: "pH < 7,3", correta: false },
          { texto: "Sempre", correta: false },
        ],
      },
    ],
  },
  {
    titulo: "Acidente vascular cerebral isquêmico agudo",
    tema: "Neurologia de urgência",
    publico: "Internato — 6º ano de Medicina",
    objetivos:
      "Reconhecer a janela terapêutica, aplicar o NIHSS e identificar contraindicações à trombólise.",
    questoes: [
      {
        statement: "Qual a janela para trombólise endovenosa no AVC isquêmico?",
        alternatives: alternativas(
          ["Até 4,5 horas do início dos sintomas", "Até 12 horas", "Até 24 horas", "Não há limite"],
          0,
        ),
        explanationCorrect: "4,5 horas é a janela padrão; além dela, avaliar trombectomia por imagem.",
      },
      {
        statement: "Qual exame é obrigatório antes da trombólise?",
        alternatives: alternativas(
          [
            "Tomografia de crânio sem contraste",
            "Ressonância com contraste",
            "Angiografia digital",
            "Eletroencefalograma",
          ],
          0,
        ),
        explanationCorrect: "Serve para excluir hemorragia — é o que muda a conduta imediatamente.",
      },
      {
        statement: "Qual é contraindicação absoluta à trombólise?",
        alternatives: alternativas(
          ["Hemorragia intracraniana na tomografia", "Idade acima de 70 anos", "NIHSS acima de 20", "Hipertensão leve"],
          0,
        ),
        explanationCorrect: "Sangramento intracraniano é absoluta; idade e NIHSS alto não são.",
      },
      {
        statement: "Qual alvo pressórico antes da trombólise?",
        alternatives: alternativas(
          ["Abaixo de 185/110 mmHg", "Abaixo de 140/90 mmHg", "Abaixo de 160/100 mmHg", "Não há alvo"],
          0,
        ),
        explanationCorrect: "Acima de 185/110 o risco de sangramento pós-trombólise sobe.",
      },
      {
        statement: "O que o NIHSS mede?",
        alternatives: alternativas(
          ["Gravidade do déficit neurológico", "Risco de recorrência em 5 anos", "Extensão da área de penumbra", "Probabilidade de origem cardioembólica"],
          0,
        ),
        explanationCorrect: "É escala de gravidade do déficit, aplicada à beira do leito.",
      },
    ],
    enquete: [
      {
        enunciado: "Primeira providência na suspeita de AVC agudo:",
        opcoes: [
          { texto: "Tomografia de crânio", correta: true },
          { texto: "Anti-hipertensivo venoso", correta: false },
          { texto: "Antiagregante imediato", correta: false },
        ],
      },
      {
        enunciado: "Paciente acordou com o déficit. A janela conta a partir de:",
        opcoes: [
          { texto: "Última vez visto bem", correta: true },
          { texto: "Hora em que acordou", correta: false },
          { texto: "Chegada ao hospital", correta: false },
        ],
      },
    ],
  },
];

/**
 * Embaralha as alternativas e reetiqueta A–D.
 *
 * Nos temas acima a correta é sempre a primeira, porque é assim que se escreve
 * e revisa a lista. Sem embaralhar, o gabarito de todo simulado seria "A, A, A"
 * — a primeira coisa que denuncia dado de mentira quando alguém abre a prévia.
 */
function embaralharAlternativas(questoes: Questao[]): Questao[] {
  return questoes.map((questao) => {
    const alternativas = [...questao.alternatives];
    for (let i = alternativas.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [alternativas[i], alternativas[j]] = [alternativas[j], alternativas[i]];
    }
    return {
      ...questao,
      alternatives: alternativas.map((alternativa, i) => ({
        ...alternativa,
        label: String.fromCharCode(65 + i),
      })),
    };
  });
}

const NOMES = [
  "Ana Beatriz Ramos", "Bruno Carvalho Lima", "Camila Andrade Souza",
  "Diego Fontes Moreira", "Eduarda Nunes Pires", "Felipe Barros Tavares",
  "Gabriela Martins Rocha", "Henrique Alves Peixoto", "Isabela Queiroz Dias",
  "João Pedro Vasconcelos", "Karina Lopes Ferreira", "Lucas Teixeira Amaral",
  "Mariana Cordeiro Braga", "Nicolas Freitas Pinho", "Olívia Bastos Rezende",
  "Paulo Henrique Sampaio", "Queren Duarte Cunha", "Rafael Monteiro Leal",
  "Sofia Marques Bittencourt", "Thiago Nogueira Prado", "Ursula Camargo Neves",
  "Vitor Hugo Estevam", "Yasmin Cavalcante Reis", "Zélia Fonseca Aguiar",
  "Arthur Bezerra Coelho", "Beatriz Siqueira Mota", "Caio Rodrigues Villela",
  "Daniela Xavier Pontes", "Emanuel Correia Bastos", "Fernanda Rios Machado",
];

/**
 * Perfil de aprendizagem do aluno, como fração de acerto.
 *
 * A distribuição é intencionalmente desigual: uma turma toda em 70% não exercita
 * as faixas do gráfico nem os insights de "aluno em risco".
 */
const PERFIS = [
  { peso: 3, min: 0.15, max: 0.4 },
  { peso: 8, min: 0.4, max: 0.65 },
  { peso: 12, min: 0.65, max: 0.85 },
  { peso: 6, min: 0.85, max: 1.0 },
];

function fracaoDeAcerto(): number {
  const total = PERFIS.reduce((s, p) => s + p.peso, 0);
  let sorteio = rand() * total;
  for (const perfil of PERFIS) {
    sorteio -= perfil.peso;
    if (sorteio <= 0) return perfil.min + rand() * (perfil.max - perfil.min);
  }
  return 0.7;
}

// --------------------------------------------------------------------- seed

interface Aluno {
  /** Id **real** do usuário no legado, em texto — é a chave da tentativa. */
  usuarioId: string;
  nome: string;
  email: string;
  /** Habilidade base; a nota por simulado varia em volta dela. */
  habilidade: number;
}

/** Nomes da turma, repetindo com sufixo se pedirem mais gente que a lista tem. */
function nomesDaTurma(quantos: number): string[] {
  return Array.from({ length: quantos }, (_, i) => {
    const nome = NOMES[i % NOMES.length];
    const volta = Math.floor(i / NOMES.length);
    return volta === 0 ? nome : `${nome} ${volta + 1}`;
  });
}

/**
 * Liga cada aluno do legado a uma habilidade.
 *
 * `usuarioId` é o id legado de verdade: é o que faz o ranking por aluno das
 * métricas apontar para gente que existe na turma, e não para um id inventado.
 */
function comHabilidade(alunos: AlunoLegado[]): Aluno[] {
  return alunos.map((aluno) => ({
    usuarioId: String(aluno.id),
    nome: aluno.nome,
    email: aluno.email,
    habilidade: fracaoDeAcerto(),
  }));
}

/** Nota do aluno neste simulado: habilidade base com um solavanco de ±12 p.p. */
function acertosDoAluno(aluno: Aluno, totalQuestoes: number): number {
  const variacao = (rand() - 0.5) * 0.24;
  const fracao = Math.min(1, Math.max(0, aluno.habilidade + variacao));
  return Math.round(fracao * totalQuestoes);
}

/**
 * Distribui os acertos entre as questões dando mais chance de erro nas
 * últimas — é o que cria "questões mais difíceis" em vez de um ranking plano.
 */
function respostasDoAluno(
  questoes: Questao[],
  acertosAlvo: number,
): { questaoIndex: number; alternativaLabel: string | null; acertou: boolean }[] {
  const dificuldade = questoes.map((_, i) => 0.25 + (0.6 * i) / questoes.length);
  const ordem = questoes
    .map((_, i) => i)
    .sort((a, b) => dificuldade[a] - dificuldade[b]);

  const acertadas = new Set(ordem.slice(0, acertosAlvo));

  return questoes.map((questao, index) => {
    const correta = questao.alternatives.find((a) => a.isCorrect)!.label;
    if (acertadas.has(index)) {
      return { questaoIndex: index, alternativaLabel: correta, acertou: true };
    }
    // 1 em 12 deixa em branco — o `montarResultado` trata `null`, então vale
    // exercitar esse caminho também.
    if (rand() < 1 / 12) {
      return { questaoIndex: index, alternativaLabel: null, acertou: false };
    }
    const erradas = questao.alternatives.filter((a) => !a.isCorrect);
    return {
      questaoIndex: index,
      alternativaLabel: sorteia(erradas).label,
      acertou: false,
    };
  });
}

/** Votos da turma numa questão de enquete, com a correta puxando a maioria. */
function votosDaEnquete(
  opcoes: { texto: string; correta: boolean }[],
  participantes: number,
): { texto: string; correta: boolean; votos: number; pct: number }[] {
  const pesos = opcoes.map((o) => (o.correta ? 2 + rand() * 3 : 0.4 + rand() * 1.6));
  const somaPesos = pesos.reduce((s, p) => s + p, 0);

  const votos = pesos.map((p) => Math.floor((p / somaPesos) * participantes));
  // Sobras do arredondamento vão para a primeira opção, para o total fechar.
  votos[0] += participantes - votos.reduce((s, v) => s + v, 0);

  const total = votos.reduce((s, v) => s + v, 0);
  return opcoes.map((o, i) => ({
    texto: o.texto,
    correta: o.correta,
    votos: votos[i],
    pct: total > 0 ? Math.round((100 * votos[i]) / total) : 0,
  }));
}

const json = (valor: unknown): Prisma.InputJsonValue =>
  valor as Prisma.InputJsonValue;

async function limpar(professor: string): Promise<number> {
  // Chega nas aulas pelos blocos marcados; `onDelete: Cascade` leva tentativas
  // e resultados junto.
  const blocos = await prisma.aulaBloco.findMany({
    where: {
      aula: { professorId: professor },
      config: { path: ["seed"], equals: SEED_TAG },
    },
    select: { aulaId: true },
  });

  const aulaIds = [...new Set(blocos.map((b) => b.aulaId))];
  if (aulaIds.length === 0) return 0;

  await prisma.aula.deleteMany({ where: { id: { in: aulaIds } } });
  return aulaIds.length;
}

interface ContextoSeed {
  legado: SeedLegado;
  empId: number;
  turmaId: number;
  turma: Aluno[];
}

async function semear(opcoes: Opcoes, ctx: ContextoSeed): Promise<void> {
  const { legado, empId, turmaId, turma } = ctx;
  const quantasAulas = Math.min(opcoes.aulas, TEMAS.length);

  if (opcoes.aulas > TEMAS.length) {
    console.warn(
      `Só existem ${TEMAS.length} temas escritos — criando ${TEMAS.length} aulas em vez de ${opcoes.aulas}.`,
    );
  }

  const casosUsados: number[] = [];

  for (let i = 0; i < quantasAulas; i++) {
    const tema = TEMAS[i];
    // Aulas espalhadas no passado: a tela de métricas fica sem sentido se tudo
    // tiver acontecido no mesmo instante.
    const diasAtras = (quantasAulas - i) * 7 + inteiroEntre(0, 3);
    const quando = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);

    // Um caso do acervo da empresa por aula. Se o acervo acabar, a aula segue
    // sem caso — simulado e enquete não dependem dele.
    const caso = await legado.escolherCaso(empId, casosUsados);
    if (caso) casosUsados.push(caso.id);

    const aula = await prisma.aula.create({
      data: {
        professorId: opcoes.professor,
        empId,
        titulo: tema.titulo,
        modo: caso ? "caso" : "tema",
        casoLegacyId: caso?.id ?? null,
        casoTitulo: caso?.titulo ?? null,
        tema: tema.tema,
        publico: tema.publico,
        duracao: "50 min",
        formato: "presencial",
        objetivos: tema.objetivos,
        createdAt: quando,
      },
    });

    const marca = { seed: SEED_TAG };

    // ---- Caso clínico: execução da turma no legado + agregado já coletado ----
    if (caso) {
      const execucao = await legado.simularExecucaoDeCaso({
        empId,
        turmaId,
        casoLegacyId: caso.id,
        alunos: rotacionar(turma, i * 5).map((a) => ({
          id: Number(a.usuarioId),
          nome: a.nome,
          email: a.email,
        })),
        quando,
        participacao: 0.75 + rand() * 0.2,
        aleatorio: rand,
      });

      const agregado = await legado.agregarCaso({
        turmaId,
        casoLegacyId: caso.id,
        inicio: execucao.inicio,
        fim: execucao.fim,
      });

      await prisma.aulaBloco.create({
        data: {
          aulaId: aula.id,
          ordem: 0,
          tipo: "caso",
          origem: "template",
          config: json({ ...marca, casoLegacyId: caso.id, turmaId, modo: "apresenta" }),
          output: json({
            cursoLegacyId: execucao.cursoLegacyId,
            preparadoEm: execucao.inicio.toISOString(),
            liberadoEm: execucao.inicio.toISOString(),
            encerradoEm: execucao.fim.toISOString(),
            agregado,
            coletadoEm: execucao.fim.toISOString(),
            // `diagnostico` fica de fora: é texto de IA, e este script não chama
            // IA. O professor gera clicando em coletar de novo.
          }),
        },
      });

      console.log(
        `  caso "${caso.titulo}" — ${agregado.concluidos}/${agregado.alunosTotal} concluíram (${execucao.iniciaram} iniciaram)`,
      );
    }

    const questoes = embaralharAlternativas(tema.questoes);
    // Sequência da aula: caso (quando existe) → enquete → simulado. O simulado
    // é pós-aula, por isso fica sempre no fim.
    const ordemEnquete = caso ? 1 : 0;
    const ordemSimulado = ordemEnquete + 1;

    // ---- Simulado: tentativa individual por aluno ----
    const blocoSimulado = await prisma.aulaBloco.create({
      data: {
        aulaId: aula.id,
        ordem: ordemSimulado,
        tipo: "simulado",
        origem: "template",
        config: json({ ...marca, nQuestoes: questoes.length }),
        output: json({
          simulado: { title: `Simulado — ${tema.titulo}`, questions: questoes },
          geradoEm: quando.toISOString(),
          ia: true,
          publicadoEm: quando.toISOString(),
          gabaritoLiberado: true,
        }),
      },
    });

    // Nem todo mundo responde: 70% a 95% da turma, que é o que dá liga ao
    // indicador de engajamento. Quem falta **rotaciona** por aula — cortar
    // sempre o mesmo fim da lista deixaria dois alunos sem nenhum dado em
    // lugar nenhum, e o ranking por aluno ficaria com buracos fixos.
    const responderam = rotacionar(turma, i * 3).slice(
      0,
      Math.max(1, Math.round(turma.length * (0.7 + rand() * 0.25))),
    );

    await prisma.simuladoTentativa.createMany({
      data: responderam.map((aluno) => {
        const acertosAlvo = acertosDoAluno(aluno, questoes.length);
        const respostas = respostasDoAluno(questoes, acertosAlvo);
        const acertos = respostas.filter((r) => r.acertou).length;
        const total = questoes.length;
        return {
          blocoId: blocoSimulado.id,
          usuarioId: aluno.usuarioId,
          nome: aluno.nome,
          email: aluno.email,
          respostas: json(respostas),
          acertos,
          total,
          percentual: Math.round((100 * acertos) / total),
          submittedAt: new Date(
            quando.getTime() + inteiroEntre(1, 48) * 60 * 60 * 1000,
          ),
        };
      }),
    });

    // ---- Enquete: já vem agregada por questão (não há voto individual) ----
    const blocoEnquete = await prisma.aulaBloco.create({
      data: {
        aulaId: aula.id,
        ordem: ordemEnquete,
        tipo: "enquete",
        origem: "template",
        config: json(marca),
        output: json({
          perguntas: tema.enquete.map((q) => ({
            enunciado: q.enunciado,
            opcoes: q.opcoes.map((o) => ({ texto: o.texto, correta: o.correta })),
          })),
          totalQuestoes: tema.enquete.length,
          questaoAtual: tema.enquete.length - 1,
        }),
      },
    });

    for (const [indice, questao] of tema.enquete.entries()) {
      const participantes = inteiroEntre(
        Math.round(turma.length * 0.6),
        turma.length,
      );
      const opcoes = votosDaEnquete(questao.opcoes, participantes);
      const totalVotos = opcoes.reduce((s, o) => s + o.votos, 0);
      const votosCorretos = opcoes
        .filter((o) => o.correta)
        .reduce((s, o) => s + o.votos, 0);

      await prisma.enqueteResultado.create({
        data: {
          blocoId: blocoEnquete.id,
          questaoIndex: indice,
          enunciado: questao.enunciado,
          opcoes: json(opcoes),
          totalVotos,
          pctAcerto:
            totalVotos > 0 ? Math.round((100 * votosCorretos) / totalVotos) : 0,
          registradoEm: new Date(quando.getTime() + indice * 5 * 60 * 1000),
        },
      });
    }

    console.log(
      `✓ ${tema.titulo} — ${responderam.length} tentativas de simulado, ${tema.enquete.length} questões de enquete`,
    );
  }
}

async function main(): Promise<void> {
  const opcoes = lerOpcoes(process.argv.slice(2));
  const legado = new SeedLegado();

  try {
    const empresa = await legado.acharEmpresa(opcoes.empresa);
    if (!empresa) {
      throw new Error(
        `Empresa "${opcoes.empresa}" não encontrada no legado. Passe --empresa=<id> ou parte do nome.`,
      );
    }
    console.log(`Empresa: ${empresa.nome} (id ${empresa.id})`);

    // Limpa sempre antes de criar: rodar de novo repõe a base em vez de
    // acumular turmas e aulas duplicadas a cada execução.
    const aulasRemovidas = await limpar(opcoes.professor);
    const legadoRemovido = await legado.limparLegado(empresa.id);
    if (aulasRemovidas > 0 || legadoRemovido.alunos > 0) {
      console.log(
        `Seed anterior removido: ${aulasRemovidas} aula(s), ${legadoRemovido.turmas} turma(s), ` +
          `${legadoRemovido.alunos} aluno(s), ${legadoRemovido.eventos} evento(s) de caso.`,
      );
    }

    if (opcoes.limpar) {
      console.log("Pronto — nada foi criado (--limpar).");
      return;
    }

    const professorLegacyId = Number(opcoes.professor);
    if (!Number.isInteger(professorLegacyId)) {
      throw new Error(
        `--professor precisa ser o id numérico do usuário no legado (recebi "${opcoes.professor}").`,
      );
    }

    const turma = await legado.garantirTurma(
      empresa.id,
      opcoes.turma,
      professorLegacyId,
    );
    console.log(
      `Turma: ${turma.nome} (id ${turma.id}, código ${turma.codigoAcesso})`,
    );

    const alunosLegado = await legado.garantirAlunos(
      empresa.id,
      turma.id,
      nomesDaTurma(opcoes.alunos),
      PADRAO.dominio,
    );
    console.log(`Alunos matriculados: ${alunosLegado.length}`);

    console.log(`\nSemeando aulas para o professor ${opcoes.professor}…`);
    await semear(opcoes, {
      legado,
      empId: empresa.id,
      turmaId: turma.id,
      turma: comHabilidade(alunosLegado),
    });

    console.log(
      "\nPronto. Abra /metricas para os números e a aula para ver o painel do caso.",
    );
  } finally {
    await legado.fechar();
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
