/*
  Warnings:

  - You are about to drop the column `applicableOn` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `bannerText` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `categoryIds` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `displayOnHomepage` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `maxDiscountAmount` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `minPurchaseAmount` on the `Promotion` table. All the data in the column will be lost.
  - You are about to drop the column `productIds` on the `Promotion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" TEXT;

-- AlterTable
ALTER TABLE "Promotion" DROP COLUMN "applicableOn",
DROP COLUMN "bannerText",
DROP COLUMN "categoryIds",
DROP COLUMN "displayOnHomepage",
DROP COLUMN "maxDiscountAmount",
DROP COLUMN "minPurchaseAmount",
DROP COLUMN "productIds",
ADD COLUMN     "badge" TEXT,
ADD COLUMN     "badgeColor" TEXT,
ADD COLUMN     "bgColor" TEXT,
ADD COLUMN     "ctaText" TEXT DEFAULT 'Profiter maintenant',
ADD COLUMN     "features" JSONB DEFAULT '[]',
ADD COLUMN     "iconName" TEXT,
ADD COLUMN     "oldPrice" DOUBLE PRECISION,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "productImage" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "stock" INTEGER,
ADD COLUMN     "subtitle" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "website" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_approved_idx" ON "Review"("approved");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSupplier_productId_supplierId_key" ON "ProductSupplier"("productId", "supplierId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
