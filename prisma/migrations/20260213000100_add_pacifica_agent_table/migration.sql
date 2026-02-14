-- CreateTable
CREATE TABLE "PacificaAgent" (
    "id" TEXT NOT NULL,
    "masterAccount" TEXT NOT NULL,
    "agentPublicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacificaAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PacificaAgent_masterAccount_key" ON "PacificaAgent"("masterAccount");
