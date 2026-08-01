-- AlterTable: @handle único + conta pro (aditivo, seguro)
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "usernameBase" TEXT;
ALTER TABLE "User" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;

-- Índice único (NULLs múltiplos são permitidos no Postgres, por isso os users
-- existentes sem username não colidem até serem preenchidos).
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
