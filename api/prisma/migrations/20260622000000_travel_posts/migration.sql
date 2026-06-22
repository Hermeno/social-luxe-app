-- AlterTable: add isTravelEnabled to Post
ALTER TABLE "Post" ADD COLUMN "isTravelEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: TravelNode
CREATE TABLE "TravelNode" (
    "id"                 TEXT NOT NULL,
    "postId"             TEXT NOT NULL,
    "countryCode"        TEXT NOT NULL,
    "countryName"        TEXT NOT NULL,
    "views"              INTEGER NOT NULL DEFAULT 0,
    "likes"              INTEGER NOT NULL DEFAULT 0,
    "comments"           INTEGER NOT NULL DEFAULT 0,
    "objectsAdded"       INTEGER NOT NULL DEFAULT 0,
    "firstInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TravelObject
CREATE TABLE "TravelObject" (
    "id"          TEXT NOT NULL,
    "postId"      TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'emoji',
    "value"       TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelObject_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex on TravelNode
CREATE UNIQUE INDEX "TravelNode_postId_countryCode_key" ON "TravelNode"("postId", "countryCode");

-- CreateIndex
CREATE INDEX "TravelNode_postId_idx"    ON "TravelNode"("postId");
CREATE INDEX "TravelObject_postId_idx"  ON "TravelObject"("postId");

-- AddForeignKey: TravelNode → Post
ALTER TABLE "TravelNode" ADD CONSTRAINT "TravelNode_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TravelObject → Post
ALTER TABLE "TravelObject" ADD CONSTRAINT "TravelObject_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TravelObject → User
ALTER TABLE "TravelObject" ADD CONSTRAINT "TravelObject_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
