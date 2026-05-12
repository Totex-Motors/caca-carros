ALTER TABLE "wanted_cars"
  ADD COLUMN "year_to" INTEGER,
  ADD COLUMN "mileage_from" INTEGER,
  ADD COLUMN "mileage_to" INTEGER;

UPDATE "wanted_cars"
SET "year_to" = "year"
WHERE "year_to" IS NULL;
