import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repositoryUrl, writeCatalog } from "./catalog.mjs";

if (process.env.GITHUB_REPOSITORY !== "schachfeld/easy-mode-lighting")
  throw new Error("Run publication only in the Glow GitHub repository.");
const directory = mkdtempSync(join(tmpdir(), "glow-catalog-"));
const git = (args) =>
  execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
try {
  git(["init", "--initial-branch=home-assistant"]);
  git(["remote", "add", "origin", `${repositoryUrl}.git`]);
  const existing = git(["ls-remote", "--heads", "origin", "home-assistant"]);
  if (existing) {
    git(["fetch", "--depth=1", "origin", "home-assistant"]);
    git(["checkout", "-B", "home-assistant", "FETCH_HEAD"]);
  }
  const version = writeCatalog(process.cwd(), directory, {
    revision: process.env.GITHUB_SHA,
    digest: process.env.RELEASE_DIGEST,
  });
  git(["add", "."]);
  if (!git(["status", "--porcelain"]))
    console.log("Home Assistant already has this release.");
  else {
    git([
      "-c",
      "user.name=github-actions[bot]",
      "-c",
      "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit",
      "-m",
      `Publish Glow ${version}`,
    ]);
    git(["push", "origin", "HEAD:home-assistant"]);
    console.log(`Home Assistant repository updated to ${version}.`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
