-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" TEXT NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "businessCategory" TEXT,
ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "whatsapp" TEXT,
ADD COLUMN     "profileActions" TEXT[] DEFAULT ARRAY[]::TEXT[];
