const VERSION_OVERVIEW_URL = "https://ui5.sap.com/versionoverview.json";

export type UI5VersionInfo = {
  /** Version (e.g. 1.132.*) */
  version: string;
  support: "Out of maintenance" | "Maintenance";
  lts: boolean;
  eom: string;
  eocp: string;
};

export async function getMaintainedVersions() {
  const res = await fetch(VERSION_OVERVIEW_URL);
  const allVersions = ((await res.json()) as { versions: UI5VersionInfo[] })?.versions;
  if (!allVersions) throw new Error(`No UI5 versions found in response`);

  // discard of all removed and out of maintenance versions
  const validVersions = allVersions.filter((v) => v?.support === "Maintenance");
  if (!validVersions.length) throw new Error(`No maintained UI5 versions found!`);

  return validVersions;
}
