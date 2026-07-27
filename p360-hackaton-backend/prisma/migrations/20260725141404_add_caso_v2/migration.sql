-- CreateTable
CREATE TABLE "plano_aula"."curso_wrappers" (
    "id" TEXT NOT NULL,
    "caso_legacy_id" INTEGER NOT NULL,
    "emp_id" INTEGER NOT NULL,
    "curso_legacy_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_wrappers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_aula"."legacy_write_log" (
    "id" TEXT NOT NULL,
    "sessao_id" TEXT,
    "bloco_id" TEXT,
    "acao" TEXT NOT NULL,
    "tabela" TEXT NOT NULL,
    "registro_id" TEXT,
    "payload" JSONB NOT NULL,
    "professor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_write_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_aula"."caso_acesso_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "sessao_id" TEXT NOT NULL,
    "bloco_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caso_acesso_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curso_wrappers_caso_legacy_id_emp_id_key" ON "plano_aula"."curso_wrappers"("caso_legacy_id", "emp_id");

-- CreateIndex
CREATE INDEX "legacy_write_log_sessao_id_idx" ON "plano_aula"."legacy_write_log"("sessao_id");

-- CreateIndex
CREATE UNIQUE INDEX "caso_acesso_nonces_nonce_key" ON "plano_aula"."caso_acesso_nonces"("nonce");

-- CreateIndex
CREATE INDEX "caso_acesso_nonces_sessao_id_bloco_id_idx" ON "plano_aula"."caso_acesso_nonces"("sessao_id", "bloco_id");
