-- Change isTravelEnabled to opt-in (false by default)
-- All existing posts were created before travel was a real feature; reset them.
ALTER TABLE "Post" ALTER COLUMN "isTravelEnabled" SET DEFAULT false;
UPDATE "Post" SET "isTravelEnabled" = false WHERE NOT EXISTS (
  SELECT 1 FROM "TravelNode" WHERE "TravelNode"."postId" = "Post"."id"
);
