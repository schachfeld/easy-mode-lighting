import { releaseInfo } from "./release-lib.mjs";

const { version } = releaseInfo(process.cwd(), process.env.GITHUB_REF_NAME);
const response = await fetch(
  `https://api.github.com/repos/schachfeld/easy-mode-lighting/releases/tags/v${version}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  },
);
if (response.status === 404)
  console.log(`Version ${version} has not been published.`);
else if (response.ok)
  throw new Error(
    `Release v${version} already exists. Do not rebuild or move published tags; prepare a new version. To resume a failed catalog update, re-run only failed jobs.`,
  );
else
  throw new Error(
    `Cannot check release status: GitHub returned ${response.status}.`,
  );
