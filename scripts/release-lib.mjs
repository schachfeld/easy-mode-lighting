import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export function parseVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error(
      "Use a stable version like 1.0.1 (no v prefix or prerelease suffix).",
    );
  const parts = version.split(".").map(Number);
  if (parts.some((n) => !Number.isSafeInteger(n)))
    throw new Error("Version is too large.");
  return parts;
}

export function compareVersions(a, b) {
  const aa = parseVersion(a),
    bb = parseVersion(b);
  for (let i = 0; i < 3; i++)
    if (aa[i] !== bb[i]) return aa[i] < bb[i] ? -1 : 1;
  return 0;
}

export function releaseInfo(root = process.cwd(), tag) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(
    readFileSync(join(root, "package-lock.json"), "utf8"),
  );
  const config = parse(readFileSync(join(root, "config.yaml"), "utf8"));
  const version = pkg.version;
  parseVersion(version);
  if (
    [lock.version, lock.packages?.[""]?.version, config.version].some(
      (v) => v !== version,
    )
  )
    throw new Error(
      "package.json, package-lock.json, and config.yaml must have the same version.",
    );
  if (tag && tag !== `v${version}`)
    throw new Error(`Tag ${tag} does not match v${version}.`);
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const section = changelog
    .split(/^## /m)
    .find((s) => s.startsWith(`[${version}] - `));
  const notes = section?.split("\n").slice(1).join("\n").trim();
  if (!notes || /TODO: release notes/.test(notes))
    throw new Error(
      `Write the CHANGELOG.md entry for ${version} before releasing.`,
    );
  return { version, config, notes };
}

export function prepareVersion(input, root = process.cwd()) {
  const { version } = releaseInfo(root);
  const parts = parseVersion(version);
  let next;
  if (input === "patch") next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  else if (input === "minor") next = `${parts[0]}.${parts[1] + 1}.0`;
  else if (input === "major") next = `${parts[0] + 1}.0.0`;
  else {
    parseVersion(input ?? "");
    next = input;
  }
  if (compareVersions(next, version) <= 0)
    throw new Error(
      "The next version must be higher than the current version.",
    );
  for (const file of ["package.json", "package-lock.json"]) {
    const path = join(root, file);
    const value = JSON.parse(readFileSync(path, "utf8"));
    value.version = next;
    if (file === "package-lock.json") value.packages[""].version = next;
    writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
  }
  const configPath = join(root, "config.yaml");
  writeFileSync(
    configPath,
    readFileSync(configPath, "utf8").replace(
      /^version:.*$/m,
      `version: "${next}"`,
    ),
  );
  const changelogPath = join(root, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");
  writeFileSync(
    changelogPath,
    changelog.replace(
      /^# Changelog\s*/,
      `# Changelog\n\n## [${next}] - ${new Date().toISOString().slice(0, 10)}\n\n- TODO: release notes\n\n`,
    ),
  );
  return next;
}
