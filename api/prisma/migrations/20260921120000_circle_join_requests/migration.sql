-- Um Círculo publicado passa a ser vivo: quem não esteve no disparo pode pedir
-- para entrar, e qualquer pessoa pode retirar a própria fotografia. Os posts de
-- cada participante continuam a ser cópias; o que muda é que agora se encontram
-- todas pelo mesmo `circleMomentId` e são atualizadas juntas.

-- Cada pessoa pode pôr várias fotografias numa ronda (antes eram duas). O slot
-- é a ordem entre as dela, numerada pelo telemóvel e nunca reutilizada.
ALTER TABLE "CircleSessionCapture" DROP CONSTRAINT "CircleSessionCapture_slot_check";
ALTER TABLE "CircleSessionCapture"
  ADD CONSTRAINT "CircleSessionCapture_slot_check" CHECK ("slot" BETWEEN 1 AND 100);

ALTER TABLE "CircleSessionCapture" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Post" ADD COLUMN "circleMomentId" TEXT;
CREATE INDEX "Post_circleMomentId_idx" ON "Post"("circleMomentId");

-- Os Círculos já publicados (e os seus reposts) ficam ligados desde já.
UPDATE "Post"
  SET "circleMomentId" = "collectiveMoment"->>'id'
  WHERE "collectiveMoment" IS NOT NULL
    AND jsonb_typeof("collectiveMoment") = 'object'
    AND "collectiveMoment"->>'id' IS NOT NULL;

CREATE TYPE "CircleJoinStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "CircleJoinRequest" (
  "id" TEXT NOT NULL,
  "momentId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "photoWidth" INTEGER,
  "photoHeight" INTEGER,
  "status" "CircleJoinStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),

  CONSTRAINT "CircleJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CircleJoinRequest_hostId_status_idx"
  ON "CircleJoinRequest"("hostId", "status");
CREATE INDEX "CircleJoinRequest_requesterId_status_idx"
  ON "CircleJoinRequest"("requesterId", "status");
CREATE INDEX "CircleJoinRequest_momentId_requesterId_idx"
  ON "CircleJoinRequest"("momentId", "requesterId");

ALTER TABLE "CircleJoinRequest"
  ADD CONSTRAINT "CircleJoinRequest_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircleJoinRequest"
  ADD CONSTRAINT "CircleJoinRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
