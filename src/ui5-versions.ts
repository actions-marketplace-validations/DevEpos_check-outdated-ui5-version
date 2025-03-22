import * as core from "@actions/core";
import * as semver from "semver";

const VERSION_OVERVIEW_URL = "https://ui5.sap.com/versionoverview.json";

export type UI5VersionInfo = {
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

export type UI5VersionPatch = {
  version: string;
  semver: semver.SemVer;
  hidden?: boolean;
  eocp: string;
  removed?: boolean;
};

/**
 * @returns array of valid UI5 versions to be used in SAP BTP
 */
export async function fetchMaintainedVersions() {
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
  return validVersions;
}
