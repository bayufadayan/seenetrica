import { describe, expect, it } from "vitest";
import { loadArchiveLocalFirst } from "./archive-load.util";

describe("Archive local-first hydration", () => {
  it("renders IndexedDB cache before the network resolves", async () => {
    const events = [];
    let resolveNetwork;
    const network = new Promise((resolve) => { resolveNetwork = resolve; });
    const loading = loadArchiveLocalFirst({
      readCache: async () => ({ movies: [{ id: "cached" }], history: [], memories: [] }),
      fetchFresh: () => network,
      onCache: () => events.push("cache"),
      onFresh: () => events.push("network"),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["cache"]);
    resolveNetwork({ movies: [{ id: "fresh" }], history: [], memories: [] });
    await loading;
    expect(events).toEqual(["cache", "network"]);
  });

  it("keeps the cache callback visible when the network fails", async () => {
    const events = [];
    await expect(loadArchiveLocalFirst({
      readCache: async () => ({ movies: [], history: [], memories: [] }),
      fetchFresh: async () => { throw new Error("offline"); },
      onCache: () => events.push("cache"),
      onFresh: () => events.push("network"),
    })).rejects.toThrow("offline");
    expect(events).toEqual(["cache"]);
  });
});
