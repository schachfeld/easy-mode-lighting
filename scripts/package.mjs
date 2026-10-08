import { copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync("artifacts", { recursive: true });
execFileSync("tar", [
  "-czf",
  "artifacts/glow-addon.tar.gz",
  "--transform=s,^,glow/,",
  "config.yaml",
  "icon.png",
  "Dockerfile",
  ".dockerignore",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
  "public",
  "src",
  "server",
  "README.md",
  "DOCS.md",
  "CHANGELOG.md",
  "RELEASING.md",
]);
// Vite treats .gz as HTTP content encoding. The .tgz alias downloads intact.
copyFileSync("artifacts/glow-addon.tar.gz", "artifacts/glow-addon.tgz");
console.log(
  "Created artifacts/glow-addon.tar.gz and glow-addon.tgz — extract into Home Assistant /local_apps (or /addons on older versions).",
);
