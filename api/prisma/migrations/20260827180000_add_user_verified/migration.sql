-- Selo de verificação. Coluna aditiva com default: nada existente muda.
ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
