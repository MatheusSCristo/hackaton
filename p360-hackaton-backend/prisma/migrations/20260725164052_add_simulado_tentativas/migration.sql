-- CreateTable
CREATE TABLE "plano_aula"."simulado_tentativas" (
    "id" TEXT NOT NULL,
    "bloco_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nome" TEXT,
    "respostas" JSONB NOT NULL,
    "acertos" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "percentual" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulado_tentativas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulado_tentativas_bloco_id_idx" ON "plano_aula"."simulado_tentativas"("bloco_id");

-- CreateIndex
CREATE UNIQUE INDEX "simulado_tentativas_bloco_id_usuario_id_key" ON "plano_aula"."simulado_tentativas"("bloco_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "plano_aula"."simulado_tentativas" ADD CONSTRAINT "simulado_tentativas_bloco_id_fkey" FOREIGN KEY ("bloco_id") REFERENCES "plano_aula"."aula_blocos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
