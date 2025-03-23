import { jest } from "@jest/globals";
import { mockCoreWithEmptyImpl } from "../__fixtures__/core.js";
import { mockNodeFetch } from "../__fixtures__/fetch.js";
import { fetchMaintainedVersions } from "../src/ui5-versions.js";

const { mock: fetchMock, mockFetchResponse } = mockNodeFetch();

describe("ui5-versions.ts", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it("No versions fetched results in thrown error", async () => {
    const core = mockCoreWithEmptyImpl();
    mockFetchResponse({ versions: [], patches: [] });
    await expect(fetchMaintainedVersions()).rejects.toThrow(new Error("No UI5 versions found in response"));

    expect(core.info).toHaveBeenCalledWith(
      "Checking https://ui5.sap.com/versionoverview.json for available UI5 versions..."
    );
  });

  it("Versions could be fetched successfully", async () => {
    mockCoreWithEmptyImpl();
    mockFetchResponse(mockedVersionsOverview);

    const versions = await fetchMaintainedVersions();
    expect(versions).toBeDefined();
    expect(versions.versions.size).toBe(mockedVersionsOverview.versions.length);
    expect(versions.patches.size).toBe([...mockedVersionsOverview.patches].filter((p) => !p.removed).length);
  });
});

const mockedVersionsOverview = {
  versions: [
    {
      version: "1.134.*",
      support: "Maintenance",
      lts: false,
      eom: "",
      eocp: "Q1/2026"
    },
    {
      version: "1.133.*",
      support: "Maintenance",
      lts: false,
      eom: "Q3/2025",
      eocp: "Q3/2026"
    },
    {
      version: "1.132.*",
      support: "Out of maintenance",
      lts: false,
      eom: "",
      eocp: "Q2/2026"
    },
    {
      version: "1.131.*",
      support: "Out of maintenance",
      lts: false,
      eom: "",
      eocp: "Q1/2026"
    },
    {
      version: "1.114.*",
      support: "Out of maintenance",
      lts: false,
      eom: "Q4/2024",
      eocp: "Q1/2025"
    }
  ],
  patches: [
    {
      version: "1.134.0",
      eocp: "To Be Determined"
    },
    {
      version: "1.133.0",
      eocp: "To Be Determined"
    },
    {
      version: "1.132.1",
      eocp: "Q1/2026"
    },
    {
      version: "1.132.0",
      eocp: "Q1/2026"
    },
    {
      version: "1.131.1",
      eocp: "Q1/2026"
    },
    {
      version: "1.131.0",
      eocp: "Q4/2025"
    },
    {
      version: "1.130.8",
      eocp: "To Be Determined"
    },
    {
      version: "1.130.7",
      eocp: "Q1/2026"
    },
    {
      version: "1.130.6",
      eocp: "Q1/2026"
    },
    {
      version: "1.130.5",
      eocp: "Q1/2026"
    },
    {
      version: "1.130.4",
      eocp: "Q1/2026"
    },
    {
      version: "1.130.3",
      eocp: "Q4/2025"
    },
    {
      version: "1.130.2",
      eocp: "Q4/2025"
    },
    {
      version: "1.130.1",
      eocp: "Q4/2025"
    },
    {
      version: "1.114.4",
      eocp: "Q3/2024",
      removed: true
    },
    {
      version: "1.114.3",
      eocp: "Q3/2024",
      removed: true
    },
    {
      version: "1.114.2",
      eocp: "Q3/2024",
      removed: true
    },
    {
      version: "1.114.1",
      eocp: "Q3/2024",
      removed: true
    }
  ]
};
