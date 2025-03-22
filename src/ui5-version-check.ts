import * as core from "@actions/core";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import * as semver from "semver";
import * as utils from "./utils.js";
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
type UI5Version = {
  version: string;
  semver: semver.SemVer;
  patchUpdates: boolean;
};

type Manifest = {
  version: UI5Version;
  content: string;
  path: string;
  relPath: string;
};

export class UI5VersionChecker {
  private fixOutdated: boolean;
  private useLTS: boolean;
  private validVersions!: UI5VersionInfo[];
  private updatedFiles: string[] = [];
  private errorCount = 0;

  constructor(private manifestPaths: string[]) {
    this.fixOutdated = core.getBooleanInput("fixOutdated");
    this.useLTS = core.getBooleanInput("useLTS");
  }

  async run() {
    core.startGroup("Loading UI5 versions");
    await this.fetchMaintainedVersions();
    core.endGroup();

    core.info("Checking UI5 version in manifest.json files");
    this.manifestPaths.forEach((mp) => {
      core.startGroup(`Checking file '${mp}' for current UI5 version`);
      try {
        this.checkUI5Version(mp);
      } catch (e) {}
      core.endGroup();
    });
    core.setOutput("modifiedFiles", this.updatedFiles.join(","));
  }

  get hasErrors() {
    return this.errorCount > 0;
  }

  private async fetchMaintainedVersions() {
    core.info(`Checking ${VERSION_OVERVIEW_URL} for available UI5 versions...`);
    const res = await fetch(VERSION_OVERVIEW_URL);
    const ui5Versions = (await res.json()) as { versions: UI5VersionInfo[]; patches: UI5VersionPatch[] };
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

    core.info(`Found ${validVersions.length} maintained UI5 versions`);

    // collect all patches
    patches.forEach(({ semver: pSem }) => {
      const version = validVersions.find((v) => pSem.major === v.semver.major && pSem.minor === v.semver.minor);
      if (!version) return;
      version.patches.push(pSem.patch);
    });
    this.validVersions = validVersions;
  }

  private checkUI5Version(relManifestPath: string) {
    const manifest = this.getManifest(relManifestPath);
    if (!manifest) return;

    const mfVers = manifest.version;

    // determine if the current version is a valid one
    const { valid, validPatch } = this.validateVersion(manifest);

    if (validPatch) {
      core.notice(`Version ${mfVers.version} in file ${relManifestPath} matches a still maintained version`);
    } else if (this.fixOutdated) {
      this.updateVersion(manifest);
    } else {
      // check if updates are enabled
      this.errorCount++;
      if (valid) {
        // only the patch is invalid
        core.error(
          `Patch ${mfVers.semver.patch} of version ${mfVers.semver.major}.${mfVers.semver.minor} is not available`
        );
      } else {
        core.error(`Version ${mfVers.version} in file ${relManifestPath} is invalid or no longer available`);
      }
    }
    core.endGroup();
  }

  private validateVersion(manifest: Manifest) {
    const mfVers = manifest.version;
    let valid = false;
    let validPatch = false;

    if (manifest.version.patchUpdates) {
      valid = this.validVersions.some((v) => semver.compare(v.semver, mfVers.semver) === 0);
      validPatch = valid;
    } else {
      const validMajorMinor = this.validVersions.find(
        (v) => mfVers.semver.major === v.semver.major && mfVers.semver.minor === v.semver.minor
      );
      if (validMajorMinor) {
        valid = true;
        validPatch = validMajorMinor.patches.includes(mfVers.semver.patch);
      }
    }

    return { valid, validPatch };
  }

  private getManifest(relManifestPath: string): Manifest | undefined {
    const manifestPath = path.join(utils.getRepoPath(), relManifestPath);
    const manifestContent = readFileSync(manifestPath, { encoding: "utf8" });

    const mfVers = this.getManifestVersion(relManifestPath, manifestContent);
    if (!mfVers) return;

    return { version: mfVers, content: manifestContent, path: manifestPath, relPath: relManifestPath };
  }

  private getManifestVersion(manifestPath: string, manifestContent: string): UI5Version | undefined {
    const manifestJson = JSON.parse(manifestContent) as { "sap.platform.cf": { ui5VersionNumber?: string } };
    const currentVersionStr = manifestJson["sap.platform.cf"]?.ui5VersionNumber?.replace(/[xX]/, "*");
    if (!currentVersionStr) {
      core.notice(`No section 'sap.platform.cf/ui5VersionNumber' in ${manifestPath} found. Skipping check`);
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

  private updateVersion(manifest: Manifest) {
    // retrieve version according to settings
    const newVersion = this.useLTS ? this.validVersions.find((v) => v.lts) : this.validVersions[0];
    if (!newVersion) {
      if (this.useLTS) {
        core.error(`No valid LTS UI5 version found to update ${manifest.relPath}`);
      } else {
        core.error(`No valid UI5 version found to update ${manifest.relPath}`);
      }
      return;
    }
    const manifestContent = manifest.content.replace(
      /("sap\.platform\.cf"\s*:\s*\{\s*"ui5VersionNumber"\s*:\s*")(.*)(")/,
      `$1${newVersion.version}$3`
    );
    writeFileSync(manifest.relPath, manifestContent, { encoding: "utf8" });
    this.updatedFiles.push(manifest.relPath);
    core.notice(`Updated version in ${manifest.relPath} from ${manifest.version.version} to ${newVersion.version}`);
  }
}
