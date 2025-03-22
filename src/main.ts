import * as core from "@actions/core";
import * as utils from "./utils.js";
import { glob } from "glob";
import { getMaintainedVersions } from "./ui5-version-check.js";

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const repoPath = utils.getRepoPath();
    console.log(repoPath);

    const manifestPaths = utils.getInputAsArray("manifestPaths");
    if (!manifestPaths.length) throw new Error(`'manifestPaths' must not be empty`);
    core.startGroup("Determine manifest.json file paths");
    const fullManifestPaths = await glob(manifestPaths, { cwd: repoPath });
    if (!fullManifestPaths) throw new Error(`Glob patterns in 'manifestPaths' could not be resolved`);

    core.info(`Resolved the following manifest file paths: ${fullManifestPaths}`);
    core.endGroup();

    core.startGroup(`Loading UI5 version overview`);
    const versions = await getMaintainedVersions();
    core.info(`Found ${versions.length} UI5 maintenance versions`);
    core.endGroup();

    // Set outputs for other workflow steps to use
    // core.setOutput("time", new Date().toTimeString());
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
