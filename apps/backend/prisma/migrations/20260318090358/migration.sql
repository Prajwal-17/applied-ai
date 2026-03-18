-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);
