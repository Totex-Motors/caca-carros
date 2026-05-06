-- CreateEnum
CREATE TYPE "WantedCarStatus" AS ENUM ('PENDING', 'FOUND');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wanted_cars" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "max_price" INTEGER NOT NULL,
    "status" "WantedCarStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wanted_cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "mileage" INTEGER,
    "fuel" TEXT,
    "url" TEXT NOT NULL,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "wanted_car_id" TEXT NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cars_wanted_car_id_idx" ON "cars"("wanted_car_id");

-- CreateIndex
CREATE INDEX "cars_created_at_idx" ON "cars"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cars_wanted_car_id_url_key" ON "cars"("wanted_car_id", "url");

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_wanted_car_id_fkey" FOREIGN KEY ("wanted_car_id") REFERENCES "wanted_cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
