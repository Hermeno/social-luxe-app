-- CreateEnum
CREATE TYPE "PairingType" AS ENUM ('AMIGOS', 'AMORES', 'IRMAOS', 'BESTS', 'BONITONAS', 'GEMEAS', 'OUTRO');

-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Pairing" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "type" "PairingType" NOT NULL,
    "customLabel" TEXT,
    "status" "PairingStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Pairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pairing_userAId_userBId_key" ON "Pairing"("userAId", "userBId");
CREATE INDEX "Pairing_userAId_idx" ON "Pairing"("userAId");
CREATE INDEX "Pairing_userBId_idx" ON "Pairing"("userBId");

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
