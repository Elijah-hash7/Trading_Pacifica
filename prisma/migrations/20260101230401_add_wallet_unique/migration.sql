/*
  Warnings:

  - A unique constraint covering the columns `[walletAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `walletAddress` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "User_fid_key";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "fid" SET DEFAULT 0,
ALTER COLUMN "walletAddress" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
