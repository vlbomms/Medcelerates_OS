/*
  Warnings:

  - You are about to drop the column `timeLeftSeconds` on the `Test` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Test" DROP COLUMN "timeLeftSeconds",
ADD COLUMN     "pausedTime" TIMESTAMP(3),
ADD COLUMN     "remainingSeconds" INTEGER,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "startTime" TIMESTAMP(3),
ADD COLUMN     "totalTestDuration" INTEGER NOT NULL DEFAULT 3600;
