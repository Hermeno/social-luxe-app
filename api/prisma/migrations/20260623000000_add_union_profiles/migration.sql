-- CreateEnum
CREATE TYPE "UnionType" AS ENUM ('COUPLE', 'TWINS', 'PARTNERS', 'FRIENDS', 'CREATIVE');

-- CreateEnum
CREATE TYPE "UnionInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Union" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "type" "UnionType" NOT NULL,
    "bio" TEXT,
    "memberAId" TEXT NOT NULL,
    "memberBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Union_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnionInvite" (
    "id" TEXT NOT NULL,
    "fromUnionId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "UnionInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnionInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnionMessage" (
    "id" TEXT NOT NULL,
    "fromUnionId" TEXT NOT NULL,
    "toUnionId" TEXT NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Union_memberAId_memberBId_key" ON "Union"("memberAId", "memberBId");
CREATE INDEX "Union_memberAId_idx" ON "Union"("memberAId");
CREATE INDEX "Union_memberBId_idx" ON "Union"("memberBId");

-- CreateIndex
CREATE UNIQUE INDEX "UnionInvite_fromUnionId_toUserId_key" ON "UnionInvite"("fromUnionId", "toUserId");
CREATE INDEX "UnionInvite_toUserId_idx" ON "UnionInvite"("toUserId");

-- CreateIndex
CREATE INDEX "UnionMessage_fromUnionId_toUnionId_createdAt_idx" ON "UnionMessage"("fromUnionId", "toUnionId", "createdAt" DESC);
CREATE INDEX "UnionMessage_toUnionId_fromUnionId_createdAt_idx" ON "UnionMessage"("toUnionId", "fromUnionId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Union" ADD CONSTRAINT "Union_memberAId_fkey" FOREIGN KEY ("memberAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Union" ADD CONSTRAINT "Union_memberBId_fkey" FOREIGN KEY ("memberBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionInvite" ADD CONSTRAINT "UnionInvite_fromUnionId_fkey" FOREIGN KEY ("fromUnionId") REFERENCES "Union"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionInvite" ADD CONSTRAINT "UnionInvite_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnionMessage" ADD CONSTRAINT "UnionMessage_fromUnionId_fkey" FOREIGN KEY ("fromUnionId") REFERENCES "Union"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionMessage" ADD CONSTRAINT "UnionMessage_toUnionId_fkey" FOREIGN KEY ("toUnionId") REFERENCES "Union"("id") ON DELETE CASCADE ON UPDATE CASCADE;
