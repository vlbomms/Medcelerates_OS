/*
  Warnings:

  - You are about to drop the column `stripeSubscriptionId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripePaymentIntentId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripePaymentIntentId_key" ON "User"("stripePaymentIntentId");
