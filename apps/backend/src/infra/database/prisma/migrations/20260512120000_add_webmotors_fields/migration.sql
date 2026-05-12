ALTER TABLE "cars"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "transmission" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "photos" TEXT[] NOT NULL DEFAULT '{}'::text[];

UPDATE "cars"
SET "title" = CONCAT("brand", ' ', "model")
WHERE "title" IS NULL;

UPDATE "cars"
SET "photos" = CASE
  WHEN "image" IS NOT NULL THEN ARRAY["image"]
  ELSE '{}'::text[]
END;
