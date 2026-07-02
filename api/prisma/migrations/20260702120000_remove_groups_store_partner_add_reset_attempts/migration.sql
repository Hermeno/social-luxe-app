-- DropForeignKey
ALTER TABLE "GroupChat" DROP CONSTRAINT "GroupChat_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMessage" DROP CONSTRAINT "GroupMessage_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMessage" DROP CONSTRAINT "GroupMessage_replyToId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMessage" DROP CONSTRAINT "GroupMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "PartnerRequest" DROP CONSTRAINT "PartnerRequest_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "PartnerRequest" DROP CONSTRAINT "PartnerRequest_senderId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "ProductSave" DROP CONSTRAINT "ProductSave_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductSave" DROP CONSTRAINT "ProductSave_userId_fkey";

-- AlterTable
ALTER TABLE "PasswordReset" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "partnerId",
DROP COLUMN "partnerName",
DROP COLUMN "relationshipStatus";

-- DropTable
DROP TABLE "GroupChat";

-- DropTable
DROP TABLE "GroupMember";

-- DropTable
DROP TABLE "GroupMessage";

-- DropTable
DROP TABLE "PartnerRequest";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "ProductSave";

-- DropEnum
DROP TYPE "GroupType";
