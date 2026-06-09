-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('COMMUNITY', 'GROUP');

-- AlterTable GroupChat: add description and type
ALTER TABLE "GroupChat" ADD COLUMN "description" TEXT;
ALTER TABLE "GroupChat" ADD COLUMN "type" "GroupType" NOT NULL DEFAULT 'COMMUNITY';

-- AlterTable GroupMessage: add replyToId, drop mediaUrl
ALTER TABLE "GroupMessage" ADD COLUMN "replyToId" TEXT;

-- Fix cascade deletes on GroupMember
ALTER TABLE "GroupMember" DROP CONSTRAINT IF EXISTS "GroupMember_groupId_fkey";
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMember" DROP CONSTRAINT IF EXISTS "GroupMember_userId_fkey";
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix cascade deletes on GroupMessage
ALTER TABLE "GroupMessage" DROP CONSTRAINT IF EXISTS "GroupMessage_groupId_fkey";
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMessage" DROP CONSTRAINT IF EXISTS "GroupMessage_senderId_fkey";
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add self-reference for replies
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "GroupMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
