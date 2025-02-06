/*
  Warnings:

  - The values [RECURRING] on the enum `SubscriptionType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionType_new" AS ENUM ('ONE_TIME');
ALTER TABLE "User" ALTER COLUMN "subscriptionType" TYPE "SubscriptionType_new" USING ("subscriptionType"::text::"SubscriptionType_new");
ALTER TYPE "SubscriptionType" RENAME TO "SubscriptionType_old";
ALTER TYPE "SubscriptionType_new" RENAME TO "SubscriptionType";
DROP TYPE "SubscriptionType_old";
COMMIT;
