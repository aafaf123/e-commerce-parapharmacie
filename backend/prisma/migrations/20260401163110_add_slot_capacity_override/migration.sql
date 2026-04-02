-- AlterTable
ALTER TABLE "TimeSlotConfig" ALTER COLUMN "capacity" SET DEFAULT 5,
ALTER COLUMN "intervalMinutes" SET DEFAULT 60;

-- CreateTable
CREATE TABLE "SlotCapacityOverride" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "slotTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotCapacityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlotCapacityOverride_dayOfWeek_slotTime_key" ON "SlotCapacityOverride"("dayOfWeek", "slotTime");
