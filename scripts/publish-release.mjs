import { execFileSync } from "node:child_process";
import { releaseInfo } from "./release-lib.mjs";

const repository = "schachfeld/easy-mode-lighting";
const { version } = releaseInfo(process.cwd(), process.env.GITHUB_REF_NAME);
const tag = `v${version}`;
const response = await fetch(
  `https://api.github.com/repos/${repository}/releases/tags/${tag}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  },
);
if (response.ok) {
  // A previous attempt may have published the release but failed to update the catalog.
  console.log(`${tag} already exists; keeping its assets and notes unchanged.`);
} else if (response.status === 404) {
  execFileSync(
    "gh",
    [
      "release",
      "create",
      tag,
      "--repo",
      repository,
      "--verify-tag",
      "--title",
      `Glow ${version}`,
      "--notes-file",
      "artifacts/release-notes.md",
      "artifacts/glow-addon.tar.gz",
      "artifacts/glow-addon.tgz",
      "artifacts/SHA256SUMS.txt",
    ],
    { stdio: "inherit" },
  );
} else
  throw new Error(
    `Cannot check release status: GitHub returned ${response.status}.`,
  );
