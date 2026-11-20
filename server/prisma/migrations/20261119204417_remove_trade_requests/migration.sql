/*
  Warnings:

  - You are about to drop the `TradeRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TradeRequest" DROP CONSTRAINT "TradeRequest_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "TradeRequest" DROP CONSTRAINT "TradeRequest_lotId_fkey";

-- DropForeignKey
ALTER TABLE "TradeRequest" DROP CONSTRAINT "TradeRequest_sellerId_fkey";

-- DropTable
DROP TABLE "TradeRequest";
