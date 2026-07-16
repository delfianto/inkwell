#!/usr/bin/env node
// Bumps the patch version across package.json, manifest.json, and versions.json
// in lockstep, then prints the new version. Used by the Dependabot
// merge-triggered release workflow (.github/workflows/dependabot-version-bump.yml).
import { readFileSync, writeFileSync } from "node:fs";

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const nextVersion = bumpPatch(pkg.version);

pkg.version = nextVersion;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = nextVersion;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[nextVersion] = minAppVersion;
writeFileSync("versions.json", `${JSON.stringify(versions, null, 2)}\n`);

console.log(nextVersion);
