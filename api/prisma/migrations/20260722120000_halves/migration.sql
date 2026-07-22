-- Migração ADITIVA de propósito.
--
-- O schema deixou de declarar Bookmark, Highlight, HighlightPost, Challenge,
-- LuxeCoin, Momento, MomentoView, PostSticker, StickerLike, StickerView,
-- StickerReaction, TravelNode, TravelObject, CircleTarget, CircleCapture e
-- CircleVote, e deixou de declarar as colunas ghostMode, coinBalance,
-- stickersEnabled e isTravelEnabled. Nada disso é apagado aqui.
--
-- Porquê: o `startCommand` do Render corre `prisma migrate deploy`, por isso um
-- DROP nesta pasta apagaria dados reais de produção sem ninguém carregar em
-- nada. As tabelas e colunas ficam onde estão, sem uso — o Prisma ignora o que
-- não está no schema, e as colunas todas têm DEFAULT, por isso os INSERTs
-- continuam a funcionar. Apagá-las é uma decisão separada, para outro dia e
-- com backup feito.

-- CreateEnum
CREATE TYPE "HalfStatus" AS ENUM ('WAITING', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Half" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "caption" TEXT,
    "targetUserId" TEXT,
    "status" "HalfStatus" NOT NULL DEFAULT 'WAITING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedById" TEXT,
    "completedUrl" TEXT,
    "postId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Half_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Half_postId_key" ON "Half"("postId");

-- CreateIndex
CREATE INDEX "Half_creatorId_status_idx" ON "Half"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Half_targetUserId_status_idx" ON "Half"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "Half_status_expiresAt_idx" ON "Half"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Half" ADD CONSTRAINT "Half_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Half" ADD CONSTRAINT "Half_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Half" ADD CONSTRAINT "Half_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Half" ADD CONSTRAINT "Half_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
