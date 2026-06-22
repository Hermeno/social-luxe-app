CREATE TABLE "StickerView" (
    "id"        TEXT         NOT NULL,
    "stickerId" TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StickerView_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StickerView" ADD CONSTRAINT "StickerView_stickerId_fkey"
    FOREIGN KEY ("stickerId") REFERENCES "PostSticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerView" ADD CONSTRAINT "StickerView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "StickerView_stickerId_userId_key" ON "StickerView"("stickerId", "userId");
