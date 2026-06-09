-- Add isAdmin to User
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Add isAnnouncement to Post
ALTER TABLE "Post" ADD COLUMN "isAnnouncement" BOOLEAN NOT NULL DEFAULT false;
