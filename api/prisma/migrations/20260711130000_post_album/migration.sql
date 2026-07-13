-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

