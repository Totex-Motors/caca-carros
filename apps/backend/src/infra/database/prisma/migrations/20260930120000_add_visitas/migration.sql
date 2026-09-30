CREATE TYPE "VisitaStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA');

CREATE TABLE "visitas" (
    "id" TEXT NOT NULL,
    "wanted_car_id" TEXT,
    "analise_id" TEXT,
    "anuncio_url" TEXT,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "versao" TEXT,
    "status" "VisitaStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "checklist" JSONB NOT NULL,
    "parecer" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visitas_wanted_car_id_idx" ON "visitas"("wanted_car_id");
CREATE INDEX "visitas_created_at_idx" ON "visitas"("created_at");
