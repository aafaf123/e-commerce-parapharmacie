-- AlterTable
ALTER TABLE "Order"
ADD COLUMN     "deliveryCityId" TEXT,
ADD COLUMN     "deliveryDistrictId" TEXT,
ADD COLUMN     "deliveryStreet" TEXT,
ADD COLUMN     "deliveryPhone" TEXT,
ADD COLUMN     "deliveryInstructions" TEXT;

-- CreateTable
CREATE TABLE "DeliveryCity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDistrict" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDayConfig" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '10:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "capacity" INTEGER NOT NULL DEFAULT 7,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCity_name_key" ON "DeliveryCity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDistrict_cityId_name_key" ON "DeliveryDistrict"("cityId", "name");

-- CreateIndex
CREATE INDEX "DeliveryDistrict_cityId_idx" ON "DeliveryDistrict"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDayConfig_dayOfWeek_key" ON "DeliveryDayConfig"("dayOfWeek");

-- AddForeignKey
ALTER TABLE "DeliveryDistrict" ADD CONSTRAINT "DeliveryDistrict_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "DeliveryCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryCityId_fkey" FOREIGN KEY ("deliveryCityId") REFERENCES "DeliveryCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryDistrictId_fkey" FOREIGN KEY ("deliveryDistrictId") REFERENCES "DeliveryDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

