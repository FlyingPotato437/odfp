-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN "instruments" JSONB;
ALTER TABLE "Dataset" ADD COLUMN "keywords" JSONB;
ALTER TABLE "Dataset" ADD COLUMN "platforms" JSONB;
ALTER TABLE "Dataset" ADD COLUMN "provenance" JSONB;

-- AlterTable
ALTER TABLE "Variable" ADD COLUMN "dims" JSONB;
ALTER TABLE "Variable" ADD COLUMN "stats" JSONB;

-- CreateTable
CREATE TABLE "TransformJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spec" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "outputUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
