-- Add salary column to User table for employee management
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "salary" DoublePrecision;