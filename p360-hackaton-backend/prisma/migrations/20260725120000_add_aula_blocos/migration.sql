-- CreateTable
CREATE TABLE "plano_aula"."aula_blocos" (
    "id" TEXT NOT NULL,
    "aula_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "config" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aula_blocos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aula_blocos_aula_id_idx" ON "plano_aula"."aula_blocos"("aula_id");

-- AddForeignKey
ALTER TABLE "plano_aula"."aula_blocos" ADD CONSTRAINT "aula_blocos_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "plano_aula"."aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
