-- Add type and content columns to PostSticker if they don't already exist
-- (table was originally created via db push without these fields)

-- The table itself predates the migration history (created via `db push`), so it's
-- missing from every earlier migration. Recreate it here for a clean replay on fresh
-- databases / the shadow database. No-op on databases where it already exists.
CREATE TABLE IF NOT EXISTS "PostSticker" (
    "id"        TEXT             NOT NULL,
    "postId"    TEXT             NOT NULL,
    "userId"    TEXT             NOT NULL,
    "emoji"     TEXT             NOT NULL,
    "x"         DOUBLE PRECISION NOT NULL,
    "y"         DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostSticker_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostSticker_postId_fkey') THEN
    ALTER TABLE "PostSticker" ADD CONSTRAINT "PostSticker_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostSticker_userId_fkey') THEN
    ALTER TABLE "PostSticker" ADD CONSTRAINT "PostSticker_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PostSticker_postId_idx" ON "PostSticker"("postId");

ALTER TABLE "PostSticker" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'emoji';
ALTER TABLE "PostSticker" ADD COLUMN IF NOT EXISTS "content" TEXT;
