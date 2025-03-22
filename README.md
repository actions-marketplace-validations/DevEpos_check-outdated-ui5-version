# Check/update UI5 versions for use in SAP Build Workzone

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub action can be used to check SAPUI5/OpenUI5 projects for the use of outdated versions (see
[SAPUI5 Version Overview](https://ui5.sap.com/versionoverview.html)).

## Usage

```yaml
- name: Check UI5 versions
  id: check-ui5
  uses: DevEpos/check-outdated-ui5-versions
  with:
    useLTS: true
    fixOutdated: true
    manifestPaths: |
      router
      app/**/webapp
```

### Action inputs

| Name            | Description                                                                                                                        | Required | Default |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `manifestPaths` | List of newline or comma-separated paths to folders that contain a `manifest.json` file. <br/> **Note**: Glob patterns can be used | ✅       |         |
| `fixOutdated`   | If `true` the outdated version will be updated to the latest or lastest LTS version                                                |          | `false` |
| `useLTS`        | Can be used to update to the latest LTS version that is currently available                                                        |          | `false` |

### Action outputs

| Name             | Description                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `foundManifests` | List of `manifest.json` file paths that have been found according to the specified paths in `manifestPaths` |
| `modifiedFiles`  | List of `manifest.json` files that have been updated. Can be used to pass to e.g. an action to create a PR  |
