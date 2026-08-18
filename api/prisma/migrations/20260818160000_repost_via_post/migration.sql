-- O contador de reposts passa a ser POR PUBLICAÇÃO, não por original.
--
-- Antes, uma cópia mostrava o total do original: uma publicação acabada de
-- nascer aparecia já com o contador do conteúdo de onde veio. `viaPostId`
-- regista a publicação onde a pessoa realmente tocou, que é a que recebe o +1.
-- O vínculo `postId` continua a apontar para o original canónico — é ele que
-- garante um repost por pessoa por conteúdo.
--
-- Backfill: as linhas existentes foram todas criadas a partir do original
-- (não havia outra forma de repostar), por isso `viaPostId = postId` é o
-- valor historicamente correto, não uma aproximação.

ALTER TABLE "Repost" ADD COLUMN "viaPostId" TEXT;

UPDATE "Repost" SET "viaPostId" = "postId" WHERE "viaPostId" IS NULL;

CREATE INDEX "Repost_viaPostId_idx" ON "Repost"("viaPostId");

-- SET NULL e não CASCADE: apagar a publicação de onde se repostou não pode
-- apagar o repost de outra pessoa — só o desliga da origem.
ALTER TABLE "Repost"
  ADD CONSTRAINT "Repost_viaPostId_fkey"
  FOREIGN KEY ("viaPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
