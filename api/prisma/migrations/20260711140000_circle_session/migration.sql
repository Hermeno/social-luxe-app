-- CreateEnum
CREATE TYPE "CircleSessionStatus" AS ENUM ('OPEN', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CircleMemberStatus" AS ENUM ('INVITED', 'JOINED');

-- CreateTable
CREATE TABLE "CircleSession" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "CircleSessionStatus" NOT NULL DEFAULT 'OPEN',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleSessionMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CircleMemberStatus" NOT NULL DEFAULT 'JOINED',
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleSessionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleSession_hostId_status_idx" ON "CircleSession"("hostId", "status");

-- CreateIndex
CREATE INDEX "CircleSessionMember_userId_status_idx" ON "CircleSessionMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CircleSessionMember_sessionId_userId_key" ON "CircleSessionMember"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "CircleSession" ADD CONSTRAINT "CircleSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleSessionMember" ADD CONSTRAINT "CircleSessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CircleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleSessionMember" ADD CONSTRAINT "CircleSessionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

