-- CreateTable StickerLike
CREATE TABLE "StickerLike" (
    "id"        TEXT         NOT NULL,
    "stickerId" TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StickerLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable StickerReaction
CREATE TABLE "StickerReaction" (
    "id"        TEXT         NOT NULL,
    "stickerId" TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "word"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StickerReaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StickerLike" ADD CONSTRAINT "StickerLike_stickerId_fkey"
    FOREIGN KEY ("stickerId") REFERENCES "PostSticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerLike" ADD CONSTRAINT "StickerLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerReaction" ADD CONSTRAINT "StickerReaction_stickerId_fkey"
    FOREIGN KEY ("stickerId") REFERENCES "PostSticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerReaction" ADD CONSTRAINT "StickerReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "StickerLike_stickerId_userId_key"          ON "StickerLike"("stickerId", "userId");
CREATE UNIQUE INDEX "StickerReaction_stickerId_userId_word_key" ON "StickerReaction"("stickerId", "userId", "word");
