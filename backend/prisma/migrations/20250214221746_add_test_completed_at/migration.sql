/*
  Warnings:

  - A unique constraint covering the columns `[testId]` on the table `Test` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_passageId_fkey";

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Test_testId_key" ON "Test"("testId");
