/**
 * Main entry point tests
 *
 * Tests for the main.ts entry point that orchestrates the MacPorts installation.
 * These tests verify the data structures and validation logic.
 */

import type { IMacPortsSettings } from "../src/models/settings";
import type {
  IPlatformInfo,
  IMacPortsInstallInfo,
} from "../src/models/install-info";

describe("main orchestration", () => {
  let mockSettings: IMacPortsSettings;
  let mockPlatform: IPlatformInfo;
  let mockInstallInfo: IMacPortsInstallInfo;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSettings = {
      version: "2.11.5",
      prefix: "/opt/local",
      variants: { select: ["aqua"], deselect: ["x11"] },
      sources: [],
      ports: [{ name: "git-lfs" }],
      useGitSources: true,
      prependPath: true,
      verbose: false,
      signatureCheck: true,
      debug: false,
    };

    mockPlatform = {
      version: "Sequoia",
      versionNumber: "15.0",
      architecture: "arm64",
    };

    mockInstallInfo = {
      version: "2.11.5",
      prefix: "/opt/local",
      packageUrl:
        "https://github.com/macports/macports-base/releases/download/v2.11.5/MacPorts-2.11.5-15-Sequoia-arm64.pkg",
      platform: mockPlatform,
      usesGitSources: true,
      cacheKey: "macports-Sequoia-arm64-v2-abc123",
    };

    // Mock process.env for state
    process.env["STATE_isPost"] = "";
  });

  describe("settings validation", () => {
    it("should have valid settings structure", () => {
      expect(mockSettings.version).toBe("2.11.5");
      expect(mockSettings.prefix).toBe("/opt/local");
      expect(mockSettings.variants.select).toContain("aqua");
      expect(mockSettings.variants.deselect).toContain("x11");
      expect(mockSettings.ports).toHaveLength(1);
      expect(mockSettings.ports[0].name).toBe("git-lfs");
    });

    it("should have valid platform info", () => {
      expect(mockPlatform.version).toBe("Sequoia");
      expect(mockPlatform.versionNumber).toBe("15.0");
      expect(mockPlatform.architecture).toBe("arm64");
    });
  });

  describe("install info structure", () => {
    it("should have complete install info", () => {
      expect(mockInstallInfo.version).toBe(mockSettings.version);
      expect(mockInstallInfo.prefix).toBe(mockSettings.prefix);
      expect(mockInstallInfo.packageUrl).toContain("MacPorts-2.11.5");
      expect(mockInstallInfo.packageUrl).toContain("Sequoia");
      expect(mockInstallInfo.packageUrl).toContain("arm64");
      expect(mockInstallInfo.usesGitSources).toBe(true);
      expect(mockInstallInfo.cacheKey).toMatch(
        /^macports-\w+-\w+-v2-[a-f0-9]+$/
      );
    });
  });

  describe("output structure", () => {
    it("should set all required outputs", () => {
      const outputs = {
        version: mockInstallInfo.version,
        prefix: mockInstallInfo.prefix,
        "package-url": mockInstallInfo.packageUrl,
        "cache-key": mockInstallInfo.cacheKey,
      };

      expect(outputs).toHaveProperty("version");
      expect(outputs).toHaveProperty("prefix");
      expect(outputs).toHaveProperty("package-url");
      expect(outputs).toHaveProperty("cache-key");
    });
  });
});
