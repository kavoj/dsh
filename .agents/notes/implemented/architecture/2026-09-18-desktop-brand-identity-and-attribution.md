# Agent Note: Desktop release identity and derived-distribution attribution

Status: implemented

English | [中文](2026-09-18-desktop-brand-identity-and-attribution.zh.md)

## Problem

The Desktop release packs exactly one product: `productName: 'DeepSeek Harness'`, `artifactName: 'deepseek-harness-${version}-${os}-${arch}.${ext}'`, and the upstream whale icons, all written literally into `apps/desktop/scripts/electron-builder-config.mjs`. The SuiXing distribution has to ship the same shell under its own name, filenames, and artwork, and — being a derived distribution — has to state its DeepSeek Harness lineage, its MIT license, and its third-party notices where a user can actually find them. Hardcoding a second brand into the builder config forks the release pipeline; leaving the artwork alone ships upstream icons under someone else's product name; and the native About panel read its name from a literal, so a rebranded build would still introduce itself as DeepSeek Harness. Meanwhile the upstream release must not change at all.

## Decision

`apps/desktop/scripts/desktop-product-identity.mjs` is the single source of the packaged identity: `productName`, `artifactSlug`, `artifactName`, the three icon paths, and the attribution a derived distribution owes. Precedence is `DSH_DESKTOP_PRODUCT_NAME`, then `DSH_CLIENT_BUILD_PROFILE === 'suixing'`, then the upstream default; `DSH_DESKTOP_ARTIFACT_SLUG` overrides the slug otherwise derived from the product name, and `DSH_DESKTOP_ICON_DIRECTORY` — relative paths resolve from `apps/desktop` — must hold `icon-macos.png` and `icon-windows.png`.

Two consistency rules make a half-branded release impossible rather than merely discouraged. A product name other than `DeepSeek Harness` without `DSH_DESKTOP_ICON_DIRECTORY` is rejected, so upstream artwork can never ship under another name; and the attribution sources must resolve, so a derived release cannot be built without its license and notices. "Derived" is defined as exactly "product name differs from upstream", which is why the two arrive together and never separately.

The identity then flows through three surfaces. `extraMetadata` gains `dshDesktopProductName` and `dshDesktopAttribution`, `extraResources` gains the repository `LICENSE` and `THIRD_PARTY_NOTICES.md` beside the runtime, and `src/main.ts` reads those manifest fields when it sets the native About panel — `app.setAboutPanelOptions` now runs after the packaged manifest is read, and a field that is absent, empty, whitespace, or not a string falls back to the upstream name and an empty attribution line. The upstream identity contributes an empty metadata object and an empty resource list, so its manifest, its resource list, and its About panel keep the exact bytes they published before this change.

The artifact basename is reconstructed through the same resolver in `apps/desktop/scripts/desktop-upload-plan.ts` and in `apps/desktop/scripts/package-macos.ts`, including the `.app` bundle directory. The installed-update qualification harness deliberately pins the upstream product name and slug, because that harness validates the fixed filenames its own distribution step generates.

Release settings belong to the target dotenv file, so the three new variables join the shared-settings allowlist and the ambient-scrubbing pattern in `apps/desktop/scripts/desktop-package-environment.mjs`, and `validateDesktopPackageEnvironment` resolves the identity before signing or downloading.

## Alternatives considered

**A second hardcoded brand in the builder config.** Cheapest to write and the worst to keep: every later distribution edits the release pipeline, and the two literal sets drift apart silently. Failures would appear as a mismatched `.app` name or an upload plan that cannot find its artifacts.

**Brand by artifact slug alone.** The slug is only the filename prefix. The About panel, the `.app` directory, the installer's registered product name, and the icon would all still say DeepSeek Harness.

**Read the About name through `app.getName()`.** Electron resolves that from the packaged manifest, so a branded build would probably work. Nothing in the repository pins that electron-builder writes `productName` where Electron reads it, and the panel would then rest on an implicit packaging behavior instead of a field the release records itself, which is also the one thing a test can assert.

**Always write the attribution, including for upstream.** The upstream product is the origin of the work; attributing it to itself changes the published About panel and manifest for no legal gain and would break the "default release is untouched" requirement.

**A client-side About page registered through `settings.section`.** It would add a second About surface with its own dictionary, styles, and tests, while the native panel already occupies the menu slot users open. The full third-party notices are far too long for a panel, which is why they ship as a file instead.

**Decide the attribution at packaging time from the dotenv file.** The dotenv file also configures credentials and environments; a brand decision that only exists there cannot be reviewed in the repository, and a release repackaged from another checkout would silently lose it.

## Consequences

`apps/desktop/scripts/desktop-product-identity.mjs` and its declaration file own the identity; `electron-builder.config.d.mts` widens `extraResources` from a fixed two-element tuple to a list, and its `extraMetadata` gains the two optional attribution fields. `apps/desktop/electron-builder.config.mjs` computes none of this itself — it spreads what the resolver returned.

A branded desktop build now needs branded desktop artwork. The repository ships only the 108px client logo, and the brand rules forbid upscaling it, so the desktop icon set stays product-supplied and its absence fails the build loudly. This is a deliberate gap, not a finished brand: `DSH_DESKTOP_ICON_DIRECTORY` is the seam where the artwork arrives.

The About panel is now set during the manifest read rather than before the menu is built. The panel is only read when a user opens it, so the later call is not observable, and the startup suite asserts the resulting options for both the upstream and a branded manifest.

The desktop release documentation, both `.env.*.example` templates, and the desktop identity suite (`apps/desktop/tests/desktop-product-identity.spec.ts`) cover the precedence, the rejections, the artifact basename, and the "default bytes untouched" claim. `apps/desktop/tests/main-startup.spec.ts` covers the panel itself, and its harness now exposes the manifest fields a release records.
