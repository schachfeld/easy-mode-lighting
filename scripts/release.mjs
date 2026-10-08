import { execFileSync } from "node:child_process";
import { releaseInfo, prepareVersion } from "./release-lib.mjs";

try {
  const command = process.argv[2] ?? "check";
  const tag =
    process.env.GITHUB_REF_TYPE === "tag"
      ? process.env.GITHUB_REF_NAME
      : undefined;
  if (command === "prepare") {
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    });
    if (dirty.trim())
      throw new Error(
        "Commit or stash your changes before preparing a release.",
      );
    const version = prepareVersion(process.argv[3]);
    console.log(
      `Prepared ${version}. Replace the TODO in CHANGELOG.md, run npm run release:check, and commit the version files through a pull request. Publishing starts only when you push tag v${version}.`,
    );
  } else if (command === "check" || command === "notes") {
    const info = releaseInfo(process.cwd(), tag);
    console.log(
      command === "notes"
        ? info.notes
        : `Release metadata is consistent: ${info.version}`,
    );
  } else
    throw new Error(
      "Use check, notes, or prepare <patch|minor|major|version>.",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
