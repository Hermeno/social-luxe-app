-- CreateEnum
CREATE TYPE "CircleCaptureStatus" AS ENUM ('PENDING', 'LIVE', 'REJECTED');

-- CreateTable
CREATE TABLE "CircleTarget" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleCapture" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "status" "CircleCaptureStatus" NOT NULL DEFAULT 'PENDING',
    "approvals" INTEGER NOT NULL DEFAULT 0,
    "rejections" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleVote" (
    "id" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "match" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleCapture_targetId_status_idx" ON "CircleCapture"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CircleCapture_targetId_userId_key" ON "CircleCapture"("targetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleVote_captureId_voterId_key" ON "CircleVote"("captureId", "voterId");

-- AddForeignKey
ALTER TABLE "CircleCapture" ADD CONSTRAINT "CircleCapture_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CircleTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleCapture" ADD CONSTRAINT "CircleCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleVote" ADD CONSTRAINT "CircleVote_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "CircleCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleVote" ADD CONSTRAINT "CircleVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

