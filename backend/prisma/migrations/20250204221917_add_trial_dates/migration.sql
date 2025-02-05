-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSubscriptionEndDate" TIMESTAMP(3),
ADD COLUMN     "trialEndDate" TIMESTAMP(3),
ADD COLUMN     "trialStartDate" TIMESTAMP(3);
