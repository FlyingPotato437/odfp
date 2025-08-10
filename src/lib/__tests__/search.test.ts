import { describe, it, expect } from "vitest";
import { executeSearch } from "@/lib/search";

describe("executeSearch", () => {
  it("returns results for SST query", async () => {
    const res = await executeSearch({ q: "sea surface temperature" });
    expect(res.total).toBeGreaterThan(0);
    expect(res.results[0].title.toLowerCase()).toContain("temperature");
  });

  it("filters by bbox", async () => {
    const res = await executeSearch({ bbox: [-130, 30, -115, 45] });
    expect(res.results.some((r) => r.title.toLowerCase().includes("california"))).toBe(true);
  });
});

