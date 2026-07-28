-- CreateTable
CREATE TABLE "plano_aula"."enquete_resultados" (
    "id" TEXT NOT NULL,
    "bloco_id" TEXT NOT NULL,
    "questao_index" INTEGER NOT NULL,
    "enunciado" TEXT NOT NULL,
    "opcoes" JSONB NOT NULL,
    "total_votos" INTEGER NOT NULL,
    "pct_acerto" INTEGER NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquete_resultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquete_resultados_bloco_id_idx" ON "plano_aula"."enquete_resultados"("bloco_id");

-- CreateIndex
CREATE UNIQUE INDEX "enquete_resultados_bloco_id_questao_index_key" ON "plano_aula"."enquete_resultados"("bloco_id", "questao_index");

-- AddForeignKey
ALTER TABLE "plano_aula"."enquete_resultados" ADD CONSTRAINT "enquete_resultados_bloco_id_fkey" FOREIGN KEY ("bloco_id") REFERENCES "plano_aula"."aula_blocos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
