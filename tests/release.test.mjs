import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import {
  releaseInfo,
  prepareVersion,
  compareVersions,
} from "../scripts/release-lib.mjs";
import { writeCatalog, imageName } from "../scripts/catalog.mjs";

function sourceFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "glow-release-test-"));
  for (const file of [
    "package.json",
    "package-lock.json",
    "config.yaml",
    "CHANGELOG.md",
    "DOCS.md",
    "icon.png",
  ])
    copyFileSync(file, join(directory, file));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("release version and tag must match all manifests and have written notes", (t) => {
  const root = sourceFixture(t);
  const info = releaseInfo(root);
  assert.equal(releaseInfo(root, `v${info.version}`).version, info.version);
  assert.throws(() => releaseInfo(root, "v99.0.0"), /does not match/);
  const path = join(root, "config.yaml");
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(/^version:.*$/m, 'version: "99.0.0"'),
  );
  assert.throws(() => releaseInfo(root), /same version/);
});

test("preparing a release keeps versions synchronized and requires actual release notes", (t) => {
  const root = sourceFixture(t);
  const previous = releaseInfo(root).version;
  const next = prepareVersion("patch", root);
  assert.equal(compareVersions(next, previous), 1);
  assert.equal(
    JSON.parse(readFileSync(join(root, "package-lock.json"))).packages[""]
      .version,
    next,
  );
  assert.equal(
    parse(readFileSync(join(root, "config.yaml"), "utf8")).version,
    next,
  );
  assert.throws(() => releaseInfo(root), /Write the CHANGELOG/);
  const changelog = join(root, "CHANGELOG.md");
  writeFileSync(
    changelog,
    readFileSync(changelog, "utf8").replace(
      "TODO: release notes",
      "Fix room brightness controls.",
    ),
  );
  assert.equal(releaseInfo(root).version, next);
  assert.throws(() => prepareVersion(previous, root), /higher/);
  assert.throws(() => prepareVersion("1.2.3-beta.1", root), /stable version/);
  assert.throws(() => prepareVersion("01.2.3", root), /stable version/);
});

test("catalog uses the verified image and refuses downgrades or replaced versions", (t) => {
  const source = sourceFixture(t);
  const destination = join(source, "catalog");
  mkdirSync(destination);
  const evidence = {
    revision: "a".repeat(40),
    digest: `sha256:${"b".repeat(64)}`,
  };
  const version = writeCatalog(source, destination, evidence);
  const config = JSON.parse(
    readFileSync(join(destination, "glow/config.json")),
  );
  assert.equal(config.version, version);
  assert.equal(config.image, imageName);
  assert.deepEqual(config.arch, ["aarch64", "amd64"]);
  assert.equal(config.ingress, true);
  assert.equal(writeCatalog(source, destination, evidence), version);
  assert.throws(
    () =>
      writeCatalog(source, destination, {
        ...evidence,
        revision: "c".repeat(40),
      }),
    /cannot be replaced/,
  );
  writeFileSync(
    join(destination, "release.json"),
    JSON.stringify({ version: "999.0.0", ...evidence }),
  );
  assert.throws(() => writeCatalog(source, destination, evidence), /downgrade/);
});

test("workflow files parse and publishing depends on successful checks and image publication", () => {
  const ci = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
  const release = parse(readFileSync(".github/workflows/release.yml", "utf8"));
  assert.equal(ci.permissions.contents, "read");
  assert.deepEqual(release.on.push.tags, ["v*"]);
  assert.equal(release.jobs.image.needs, "checks");
  assert.equal(release.jobs.publish.needs, "image");
  assert.equal(release.concurrency["cancel-in-progress"], false);
  for (const workflow of [ci, release])
    for (const job of Object.values(workflow.jobs))
      for (const step of job.steps ?? [])
        if (step.uses)
          assert.match(
            step.uses,
            /@[a-f0-9]{40}$/,
            "Pin external actions to a commit.",
          );
});
