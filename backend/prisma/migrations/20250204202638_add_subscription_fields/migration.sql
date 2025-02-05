-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "SubscriptionLength" AS ENUM ('ONE_MONTH', 'THREE_MONTHS', 'ONE_YEAR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionEndDate" TIMESTAMP(3),
ADD COLUMN     "subscriptionLength" "SubscriptionLength",
ADD COLUMN     "subscriptionStartDate" TIMESTAMP(3),
ADD COLUMN     "subscriptionType" "SubscriptionType";
