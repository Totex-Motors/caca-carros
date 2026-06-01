-- CreateEnum
CREATE TYPE "WantedCarSellerType" AS ENUM ('PRIVATE', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "wanted_cars" ADD COLUMN "seller_type" "WantedCarSellerType";
