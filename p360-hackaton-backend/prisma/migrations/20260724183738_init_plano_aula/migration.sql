-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "plano_aula";

-- CreateTable
CREATE TABLE "plano_aula"."aulas" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "emp_id" INTEGER,
    "titulo" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "caso_legacy_id" INTEGER,
    "caso_titulo" TEXT,
    "tema" TEXT,
    "publico" TEXT,
    "duracao" TEXT,
    "formato" TEXT,
    "objetivos" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_aula"."aula_materiais" (
    "id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "aula_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_aula"."aula_metricas" (
    "id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "alunos_total" INTEGER NOT NULL,
    "alunos_engajados" INTEGER NOT NULL,
    "media_acertos" INTEGER NOT NULL,
    "taxa_conclusao" INTEGER NOT NULL,

    CONSTRAINT "aula_metricas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aulas_professor_id_idx" ON "plano_aula"."aulas"("professor_id");

-- CreateIndex
CREATE INDEX "aula_materiais_aula_id_idx" ON "plano_aula"."aula_materiais"("aula_id");

-- CreateIndex
CREATE UNIQUE INDEX "aula_metricas_aula_id_key" ON "plano_aula"."aula_metricas"("aula_id");

-- AddForeignKey
ALTER TABLE "plano_aula"."aula_materiais" ADD CONSTRAINT "aula_materiais_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "plano_aula"."aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_aula"."aula_metricas" ADD CONSTRAINT "aula_metricas_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "plano_aula"."aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
