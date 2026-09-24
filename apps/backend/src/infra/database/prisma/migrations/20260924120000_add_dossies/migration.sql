CREATE TABLE "dossies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "consulta" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "modelo_ia" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "fipe" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dossies_slug_key" ON "dossies"("slug");
CREATE INDEX "dossies_created_at_idx" ON "dossies"("created_at");

CREATE TABLE "dossie_aliases" (
    "alias" TEXT NOT NULL,
    "dossie_id" TEXT NOT NULL,

    CONSTRAINT "dossie_aliases_pkey" PRIMARY KEY ("alias")
);

ALTER TABLE "dossie_aliases" ADD CONSTRAINT "dossie_aliases_dossie_id_fkey" FOREIGN KEY ("dossie_id") REFERENCES "dossies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analises_anuncio" (
    "id" TEXT NOT NULL,
    "url" TEXT,
    "dados" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analises_anuncio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analises_anuncio_url_idx" ON "analises_anuncio"("url");
