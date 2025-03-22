import { readFileSync } from "fs";
import * as core from "@actions/core";
import path from "path";
import * as utils from "./utils.js";
import * as semver from "semver";
// import ui5Versions from "./versions.json" assert { type: "json" };

const VERSION_OVERVIEW_URL = "https://ui5.sap.com/versionoverview.json";

type UI5VersionInfo = {
  /** Version (e.g. 1.132.*) */
  version: string;
  semver: semver.SemVer;
  support: "Out of maintenance" | "Maintenance";
  lts: boolean;
  eom: string;
  eocp: string;
  hidden?: boolean;
  patches: number[];
};

type UI5VersionPatch = {
  version: string;
  semver: semver.SemVer;
  hidden?: boolean;
  eocp: string;
  removed?: boolean;
};

export class UI5VersionChecker {
  private fixOutdated: boolean;
  private useLatest: boolean;
  private useLatestLts: boolean;
  private validVersions!: UI5VersionInfo[];
  private errorCount = 0;

  constructor(private manifestPaths: string[]) {
    this.fixOutdated = core.getBooleanInput("fixOutdated");
    this.useLatest = core.getBooleanInput("useLatest");
    this.useLatestLts = core.getBooleanInput("useLatestLts");
  }

  async run() {
    core.startGroup("Loading UI5 versions");
    await this.fetchMaintainedVersions();
    core.endGroup();

    core.startGroup("Checking UI5 version in manifest.json files");
    this.manifestPaths.forEach((mp) => {
      core.startGroup(`Checking file '${mp}' for current UI5 version`);
      this.checkUI5Version(path.join(utils.getRepoPath(), mp));
      core.endGroup();
    });
    core.endGroup();
  }

  get hasErrors() {
    return this.errorCount > 0;
  }

  private async fetchMaintainedVersions() {
    const res = await fetch(VERSION_OVERVIEW_URL);
    const ui5Versions = ((await res.json()) as { versions: UI5VersionInfo[], patches: UI5VersionPatch[] });
    const versions = ui5Versions.versions as unknown as UI5VersionInfo[];
    const patches = (ui5Versions.patches as unknown as UI5VersionPatch[])
      .filter((p) => !p.removed && !p.hidden)
      .map((p) => {
        p.semver = semver.coerce(p.version)!;
        return p;
      });

    if (!versions) throw new Error(`No UI5 versions found in response`);

    // discard of all removed and out of maintenance versions
    const validVersions = versions
      .filter((v) => v?.support === "Maintenance")
      .map((v) => {
        v.semver = semver.coerce(v.version)!;
        v.patches = [];
        return v;
      });
    if (!validVersions.length) throw new Error(`No maintained UI5 versions found!`);

    // collect all patches
    patches.forEach(({ semver: pSem }) => {
      const version = validVersions.find((v) => pSem.major === v.semver.major && pSem.minor === v.semver.minor);
      if (!version) return;
      version.patches.push(pSem.patch);
    });
    this.validVersions = validVersions;
  }

  private checkUI5Version(manifestPath: string) {
    const manifestContent = readFileSync(manifestPath, { encoding: "utf8" });
    const mfVers = this.getManifestVersion(manifestContent);
    if (!mfVers) return;

    // determine if the current version is a valid one
    const validMatch = this.validVersions.some((v) => {
      if (mfVers.patchUpdates) {
        return semver.compare(v.semver, mfVers.semver) === 0;
      } else {
        if (mfVers.semver.major !== v.semver.major || mfVers.semver.minor !== v.semver.minor) {
          return false;
        }
        // check if patch version is a valid one
        if (!v.patches.includes(mfVers.semver.patch)) {
          core.error(`Patch ${mfVers.version} is not available`);
          return false;
        }
        return true;
      }
    });

    if (validMatch) {
      core.notice(`Version ${mfVers.version} matches a still maintained version`);
    } else {
      this.errorCount++;
      core.error(`Version ${mfVers.version} is invalid or no longer available`);
    }
    core.endGroup();
  }
  private getManifestVersion(manifestContent: string) {
    const manifestJson = JSON.parse(manifestContent) as { "sap.platform.cf": { ui5VersionNumber?: string } };
    const currentVersionStr = manifestJson["sap.platform.cf"]?.ui5VersionNumber?.replace(/[xX]/, "*");
    if (!currentVersionStr) {
      core.notice(`No section 'sap.platform.cf/ui5VersionNumber' found. Skipping check`);
      return;
    }
    let currentSemver: semver.SemVer | null;
    try {
      currentSemver = semver.coerce(currentVersionStr);
      if (!currentSemver) return;
    } catch (e) {
      core.error(e as Error);
      this.errorCount++;
      return;
    }

    return { version: currentVersionStr, semver: currentSemver, patchUpdates: /\d+\.\d+\.\*/.test(currentVersionStr) };
  }

  private updateVersion(manifest: string, manifestPath: string, newVersion: string) {
    //
  }
}
