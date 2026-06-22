-- Add efficient indexes for conversation message lookup
CREATE INDEX IF NOT EXISTS "Message_senderId_receiverId_createdAt_idx"
  ON "Message"("senderId", "receiverId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_receiverId_senderId_createdAt_idx"
  ON "Message"("receiverId", "senderId", "createdAt" DESC);

-- Fix replyToId FK: change from RESTRICT (default) to SET NULL
-- so deleting a message automatically nulls replies' replyToId
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_replyToId_fkey";
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId")
  REFERENCES "Message"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
