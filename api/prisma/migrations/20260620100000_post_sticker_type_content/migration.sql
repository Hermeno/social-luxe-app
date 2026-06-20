-- Add type and content columns to PostSticker if they don't already exist
-- (table was originally created via db push without these fields)

ALTER TABLE "PostSticker" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'emoji';
ALTER TABLE "PostSticker" ADD COLUMN IF NOT EXISTS "content" TEXT;
