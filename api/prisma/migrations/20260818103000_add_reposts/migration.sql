-- Reposts são uma relação própria. A tabela Share continua reservada às
-- partilhas externas e deixa de contaminar o total mostrado no botão de repost.
-- Não há backfill seguro: as cópias antigas não guardavam o post de origem e as
-- linhas de Share não distinguem partilha externa de repost.

CREATE TABLE "Repost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "repostedPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Repost_repostedPostId_key" ON "Repost"("repostedPostId");
CREATE UNIQUE INDEX "Repost_userId_postId_key" ON "Repost"("userId", "postId");
CREATE INDEX "Repost_postId_idx" ON "Repost"("postId");

ALTER TABLE "Repost"
  ADD CONSTRAINT "Repost_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Repost"
  ADD CONSTRAINT "Repost_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Repost"
  ADD CONSTRAINT "Repost_repostedPostId_fkey"
  FOREIGN KEY ("repostedPostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
