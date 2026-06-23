-- Replace fixed UnionType enum with free-form label field
-- Lux supports 1 union per user; the label is user-defined ("Casal", "Namorados", etc.)

ALTER TABLE "Union" ADD COLUMN "label" TEXT;
ALTER TABLE "Union" DROP COLUMN "type";
DROP TYPE IF EXISTS "UnionType";
