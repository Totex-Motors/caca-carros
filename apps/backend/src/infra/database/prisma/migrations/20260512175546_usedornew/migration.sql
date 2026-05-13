-- CreateEnum
CREATE TYPE "WantedCarCondition" AS ENUM ('NEW', 'USED');

-- AlterTable
ALTER TABLE "wanted_cars" ADD COLUMN     "condition" "WantedCarCondition";
