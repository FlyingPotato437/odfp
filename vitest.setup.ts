import { vi } from "vitest";

// Provide Gemini key fallback for tests (no network in unit tests)
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-key";

// In-memory seed dataset used by tests and mocked Prisma calls
const seededDataset = {
  id: "test-sst-california",
  doi: null as string | null,
  title: "Sea Surface Temperature near California",
  abstract: "Sea surface temperature gridded product",
  publisher: "NOAA NCEI",
  license: null as string | null,
  timeStart: new Date("2010-01-01"),
  timeEnd: new Date("2020-12-31"),
  bboxMinX: -130,
  bboxMinY: 30,
  bboxMaxX: -115,
  bboxMaxY: 45,
  sourceSystem: "TEST",
  updatedAt: new Date(),
  createdAt: new Date(),
  variables: [
    { id: "v1", datasetId: "test-sst-california", name: "sea_surface_temperature", standardName: "sea_surface_temperature", units: "degC", longName: "Sea Surface Temperature" },
  ],
  distributions: [
    { id: "d1", datasetId: "test-sst-california", url: "https://example.com/test.csv", accessService: "HTTP", format: "CSV", size: null as number | null, checksum: null as string | null, accessRights: null as string | null },
  ],
};

// Mock the Prisma client used by the app so unit tests do not require a real DB
vi.mock("@/lib/db", () => {
  const prisma = {
    dataset: {
      findMany: async (args: any = {}) => {
        // Basic hydration for ids filter; ignore most Prisma "where" for unit tests
        const ids: string[] | undefined = args?.where?.id?.in || (args?.where?.id?.equals ? [args.where.id.equals] : undefined);
        const rows = !ids || ids.includes(seededDataset.id) ? [seededDataset] : [];
        return rows;
      },
      count: async (_args: any = {}) => 1,
    },
    $queryRawUnsafe: async (sql: string, ..._params: any[]) => {
      const lower = sql.toLowerCase();
      if (lower.includes('select id from "dataset"')) {
        return [{ id: seededDataset.id }];
      }
      if (lower.includes('select count(*)::int as count')) {
        return [{ count: 1 }];
      }
      return [];
    },
  };
  return { prisma };
});
