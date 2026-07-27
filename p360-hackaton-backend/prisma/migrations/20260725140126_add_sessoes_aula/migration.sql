-- CreateTable
CREATE TABLE "plano_aula"."sessoes_aula" (
    "id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "emp_id" INTEGER,
    "codigo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aguardando',
    "bloco_atual_id" TEXT,
    "estado_atual" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_aula"."sessao_participantes" (
    "id" TEXT NOT NULL,
    "sessao_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "nome" TEXT,
    "anon_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessao_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_aula_codigo_key" ON "plano_aula"."sessoes_aula"("codigo");

-- CreateIndex
CREATE INDEX "sessoes_aula_aula_id_idx" ON "plano_aula"."sessoes_aula"("aula_id");

-- CreateIndex
CREATE INDEX "sessao_participantes_sessao_id_idx" ON "plano_aula"."sessao_participantes"("sessao_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_participantes_sessao_id_usuario_id_key" ON "plano_aula"."sessao_participantes"("sessao_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_participantes_sessao_id_anon_id_key" ON "plano_aula"."sessao_participantes"("sessao_id", "anon_id");

-- AddForeignKey
ALTER TABLE "plano_aula"."sessoes_aula" ADD CONSTRAINT "sessoes_aula_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "plano_aula"."aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_aula"."sessao_participantes" ADD CONSTRAINT "sessao_participantes_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "plano_aula"."sessoes_aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
