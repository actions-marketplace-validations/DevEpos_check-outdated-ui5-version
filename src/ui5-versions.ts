import * as core from "@actions/core";
import * as semver from "semver";

const VERSION_OVERVIEW_URL = "https://ui5.sap.com/versionoverview.json";

type ExternalUI5VersionInfo = {
  /** Version (e.g. 1.132.*) */
  version: string;
  support: "Out of maintenance" | "Maintenance";
  lts: boolean;
  eom: string;
  eocp: string;
};

type ExternalUI5VersionPatch = {
  version: string;
  eocp: string;
  removed?: boolean;
  hidden?: boolean;
};

export type UI5Version = {
  semver: semver.SemVer;
  lts: boolean;
  eom: boolean;
  eocp: boolean;
};

export type UI5VersionPatch = {
  semver: semver.SemVer;
  eocp: boolean;
};

export type UI5VersionOverview = {
  versions: Map<string, UI5Version>;
  patches: Map<string, UI5VersionPatch>;
};

const yearQuarterToDate = new Map<string, boolean>();

/**
 * @returns array of valid UI5 versions to be used in SAP BTP
 */
export async function fetchMaintainedVersions(): Promise<UI5VersionOverview> {
  core.info(`Checking ${VERSION_OVERVIEW_URL} for available UI5 versions...`);
  const res = await fetch(VERSION_OVERVIEW_URL);
  const ui5Versions = (await res.json()) as { versions: ExternalUI5VersionInfo[]; patches: ExternalUI5VersionPatch[] };

  const patchMap = new Map<string, UI5VersionPatch>();

  ui5Versions.patches
    .filter((p) => !p.removed && !p.hidden)
    .forEach((p) => {
      patchMap.set(p.version, { semver: semver.coerce(p.version as string)!, eocp: checkEocp(p.eocp) });
    });

  if (!ui5Versions.versions?.length) throw new Error(`No UI5 versions found in response`);

  const versionMap = new Map<string, UI5Version>();
  ui5Versions.versions.forEach((v) => {
    versionMap.set(v.version, {
      semver: semver.coerce(v.version)!,
      lts: v.lts,
      eom: v.support !== "Maintenance",
      eocp: checkEocp(v.eocp)
    });
  });

  return { versions: versionMap, patches: patchMap };
}

function checkEocp(yearQuarter: string) {
  let eocpForYearQuarter = yearQuarterToDate.get(yearQuarter);
  if (eocpForYearQuarter !== undefined) return eocpForYearQuarter;

  const matchRes = yearQuarter.match(/Q([1-4])\/(\d+)/);
  if (!matchRes?.length) return false;

  const quarter = parseInt(matchRes[1]);
  const month = quarter === 1 ? 0 : quarter === 2 ? 3 : quarter === 3 ? 6 : 9;
  const year = parseInt(matchRes[2]);

  const dateForYearQuarter = new Date(year, month, 0);
  eocpForYearQuarter = dateForYearQuarter < new Date();
  yearQuarterToDate.set(yearQuarter, eocpForYearQuarter);
  return eocpForYearQuarter;
}
