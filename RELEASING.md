# Releasing Glow

The source repository is https://github.com/schachfeld/easy-mode-lighting. Development happens on `main`; the generated `home-assistant` branch contains only the published app catalog. Never edit the catalog branch manually.

## Normal development

1. Create a feature or fix branch.
2. Make the change and open a pull request against `main`.
3. The **CI / Checks** job checks formatting, version consistency, integration tests, TypeScript and the production build, browser tests, and installation from the packaged Docker context.
4. Merge after checks pass. Merging alone does not publish an update to Home Assistant.

## Prepare the next version

Start with a clean checkout of current `main`:

```sh
git switch main
git pull --ff-only
git switch -c release/next
npm ci
npm run release:prepare -- patch
```

Use `patch` for fixes, `minor` for features, or `major` for breaking changes. An explicit stable version such as `1.2.0` is also accepted. Prerelease channels are not configured yet.

The command updates `package.json`, both package-lock version fields, `config.yaml`, and the changelog. Replace the changelog's TODO with actual user-visible release notes, then:

```sh
npm run format
npm run release:check
npm test
npm run build
npm run test:browser
git add package.json package-lock.json config.yaml CHANGELOG.md
git commit -m "Prepare next Glow release"
git push -u origin release/next
gh pr create --base main --fill
```

Review the PR and test the candidate with a real Home Assistant instance, including its existing scenes. Automated integration tests use a simulated Home Assistant server; they cannot verify your physical devices. Merge when ready.

## Publish

From clean, updated `main`, create an annotated tag that matches the version files. For the first release, the existing files are already set to `1.0.0`; no version bump is needed:

```sh
git switch main
git pull --ff-only
npm run release:check
git tag -a v1.0.0 -m "Glow 1.0.0"
git push origin v1.0.0
```

Use the actual new version for subsequent releases. Published tags and versioned images must not be moved or replaced. A tagged commit must already be included in `main`.

The **Release** workflow:

1. Runs the same CI checks again for the tagged commit.
2. Builds and publishes `ghcr.io/schachfeld/easy-mode-lighting:VERSION` for `linux/amd64` and `linux/arm64`.
3. Pulls the exact published digest anonymously and checks actual startup on both architectures. The image revision must match the release commit.
4. Creates a GitHub release with the changelog entry, local-install archives, and SHA-256 checksums.
5. Publishes `repository.yaml`, the app manifest, documentation, icon, and release evidence to the `home-assistant` branch. The catalog cannot be downgraded or replace an existing version with different code or a different image.

Only the last step offers the update to Home Assistant. The release workflow uses GitHub's short-lived `GITHUB_TOKEN`; no registry password or Home Assistant token is required in repository secrets.

## One-time GitHub Container Registry setup

GitHub makes new container packages private by default, even when source repositories are public. The first release may therefore stop at its anonymous-pull check.

Open https://github.com/users/schachfeld/packages/container/easy-mode-lighting/settings and change the package visibility to **Public**. Then use **Re-run failed jobs** on the release run. The image has already been built; the failed publication job resumes without rebuilding it. No Home Assistant update is offered while the package is private.

See [GitHub's container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#pushing-container-images).

## Install the release channel once

After the first release succeeds, add this URL in Home Assistant's app store → **Repositories**:

```text
https://github.com/schachfeld/easy-mode-lighting#home-assistant
```

Install and start **Glow**, then enable **Show in sidebar**. Subsequent successful releases become normal Home Assistant app updates.

A manually installed `local_glow` app and a repository-installed Glow app have different Home Assistant identifiers and separate data directories. Switching installation methods does not automatically copy existing Glow scenes. Keep the local app and its backup until its `/data/scenes.json` has been migrated to the new installation. Normal version updates within the same installation preserve the persistent `/data` directory.

## Failed releases and recovery

- **Checks failed:** fix the change before publishing. If the version has not been published, use a new candidate commit and a new version/tag rather than moving an existing tag.
- **Image is private:** make the package public and re-run only failed jobs, as described above.
- **GitHub release exists but catalog publication failed:** re-run failed jobs. Existing release assets and notes are left unchanged, and the catalog update is idempotent for the same version, commit, and digest.
- **An older workflow completes late:** its catalog update is refused if a newer version has already been published.
- **A released change is faulty:** publish a new patch version. For immediate rollback, use a Home Assistant backup containing the app and its data; downgrading only the container may not reverse future data-format changes.

Before app updates, include Glow in your Home Assistant backups. Do not delete old releases or images that users may need for recovery.
