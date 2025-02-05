/*
  Warnings:

  - The values [ONE_YEAR] on the enum `SubscriptionLength` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionLength_new" AS ENUM ('ONE_MONTH', 'THREE_MONTHS');
ALTER TABLE "User" ALTER COLUMN "subscriptionLength" TYPE "SubscriptionLength_new" USING ("subscriptionLength"::text::"SubscriptionLength_new");
ALTER TYPE "SubscriptionLength" RENAME TO "SubscriptionLength_old";
ALTER TYPE "SubscriptionLength_new" RENAME TO "SubscriptionLength";
DROP TYPE "SubscriptionLength_old";
COMMIT;
