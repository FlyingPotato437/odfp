-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "doi" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "publisher" TEXT,
    "license" TEXT,
    "timeStart" TIMESTAMP(3),
    "timeEnd" TIMESTAMP(3),
    "bboxMinX" DOUBLE PRECISION,
    "bboxMinY" DOUBLE PRECISION,
    "bboxMaxX" DOUBLE PRECISION,
    "bboxMaxY" DOUBLE PRECISION,
    "sourceSystem" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variable" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardName" TEXT,
    "units" TEXT,
    "longName" TEXT,
    CONSTRAINT "Variable_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Variable_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "accessService" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "size" INTEGER,
    "checksum" TEXT,
    "accessRights" TEXT,
    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Distribution_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publisher" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CollectionDatasets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CollectionDatasets_A_fkey" FOREIGN KEY ("A") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CollectionDatasets_B_fkey" FOREIGN KEY ("B") REFERENCES "Dataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_CollectionDatasets_AB_unique" ON "_CollectionDatasets"("A", "B");

-- CreateIndex
CREATE INDEX "_CollectionDatasets_B_index" ON "_CollectionDatasets"("B");
