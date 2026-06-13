-- AlterTable User: add showDevice toggle and statusLabel badge
ALTER TABLE "User" ADD COLUMN "showDevice"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "statusLabel" TEXT;

-- AlterTable Post: add deviceModel (device used to create the post)
ALTER TABLE "Post" ADD COLUMN "deviceModel" TEXT;
