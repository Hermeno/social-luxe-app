-- Um momento coletivo é conteúdo opcional do Post existente, não uma segunda
-- feed. JSONB segue os snapshots paralelos já usados por mediaSizes/overlays e
-- mantém a publicação legível depois da limpeza da sessão efémera do Círculo.
ALTER TABLE "Post"
  ADD COLUMN "collectiveMoment" JSONB,
  ADD COLUMN "circlePublicationKey" TEXT;

ALTER TABLE "CircleSessionMember"
  ADD COLUMN "photoRoundAt" TIMESTAMP(3),
  ADD COLUMN "photoWidth" INTEGER,
  ADD COLUMN "photoHeight" INTEGER;

CREATE UNIQUE INDEX "Post_circlePublicationKey_key" ON "Post"("circlePublicationKey");

-- Rondas e capturas normalizadas. Os campos de foto no Member continuam acima
-- durante a transição para clientes antigos, mas deixam de ser a fonte de
-- verdade para álbuns coletivos.
CREATE TABLE "CircleSessionRound" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "shotAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isSolo" BOOLEAN NOT NULL DEFAULT false,
  "ownerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CircleSessionRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CircleSessionCapture" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "photoWidth" INTEGER,
  "photoHeight" INTEGER,
  "overlays" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CircleSessionCapture_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CircleSessionCapture_slot_check" CHECK ("slot" IN (1, 2))
);

CREATE INDEX "CircleSessionRound_sessionId_expiresAt_idx"
  ON "CircleSessionRound"("sessionId", "expiresAt");
CREATE INDEX "CircleSessionRound_ownerUserId_expiresAt_idx"
  ON "CircleSessionRound"("ownerUserId", "expiresAt");
CREATE UNIQUE INDEX "CircleSessionCapture_roundId_userId_slot_key"
  ON "CircleSessionCapture"("roundId", "userId", "slot");
CREATE INDEX "CircleSessionCapture_userId_createdAt_idx"
  ON "CircleSessionCapture"("userId", "createdAt");
CREATE INDEX "CircleSessionCapture_mediaUrl_idx"
  ON "CircleSessionCapture"("mediaUrl");

ALTER TABLE "CircleSessionRound"
  ADD CONSTRAINT "CircleSessionRound_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CircleSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircleSessionRound"
  ADD CONSTRAINT "CircleSessionRound_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircleSessionCapture"
  ADD CONSTRAINT "CircleSessionCapture_roundId_fkey"
  FOREIGN KEY ("roundId") REFERENCES "CircleSessionRound"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CircleSessionCapture"
  ADD CONSTRAINT "CircleSessionCapture_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
