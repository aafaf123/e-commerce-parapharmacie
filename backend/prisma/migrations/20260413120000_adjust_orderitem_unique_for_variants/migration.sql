-- Adjust OrderItem uniqueness to support variants.
-- Previous schema used @@unique([orderId, productId]) which prevents ordering multiple
-- variants of the same product in one order.

ALTER TABLE "OrderItem"
  DROP CONSTRAINT IF EXISTS "OrderItem_orderId_productId_key";

-- New uniqueness: one line per (orderId, productId, variantId).
-- Note: Postgres allows multiple NULLs in UNIQUE; the API consolidates non-variant duplicates.
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_orderId_productId_variantId_key"
  UNIQUE ("orderId", "productId", "variantId");

-- Helpful lookup index
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_productId_idx"
  ON "OrderItem" ("orderId", "productId");

