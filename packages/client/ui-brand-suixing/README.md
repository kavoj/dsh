---
description: "SuiXing occupants of the generic sidebar: the product mark and name, and the two business menus with the capability directory each opens."
kind: "package-reference"
---

# SuiXing Browser Brand and Directory

English | [中文](README.zh.md)

## Summary

This package gives a `suixing` client build its own face in the generic sidebar: the SuiXing mark and name, and the product's two business menus — AI Staff (Agent center) and Automation Factory (WorkFlow center) — each opening the capability directory it declares. Official and local builds keep the shell's fallbacks. The menus are data: this package publishes catalog groups and capability definitions into `ctx.sidebarCatalog`, and registers one main panel per menu, while the shell renders whatever a distribution published. It holds no state beyond the sidebar's fold and recency memory, and does not affect model requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)
- [Further Exploration](#further-exploration)

-----

<a id="use-this-package"></a>
## Use this package

A `suixing` build composes this package to fill the sidebar's generic seats and to publish its business menus; every other build leaves it out. The brand seats are `sidebar.brand.mark` and `sidebar.brand.name`, and the menus are published through `ctx.sidebarCatalog`. The package reads `DSH_CLIENT_BUILD_PROFILE`: under `suixing` it registers, under any other profile `apply()` returns before touching a slot, so the shell keeps its own fallbacks. The mark renders from `assets/logo.png`, a 256 pixel export of the `assets/logo.svg` master.

## Model Experience

None, as this presentation-only package does not add model-visible text, tools, or tokens.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

These limits define how the SuiXing brand and menus are supplied. They are current package constraints, not a design comparison or a task backlog.

- **The artwork is a vector reconstruction** — `assets/logo.svg` traces the 108 pixel product bitmap into arcs and gradients, and `assets/logo.png` is its 256 pixel export for embedding. Replace the master when the product team publishes an official vector.
- **The build profile is the only switch** — there is no runtime brand configuration, so changing the brand means composing another package that occupies the same slots.
- **The menus carry definitions, not working pages** — every capability row opens its menu's directory, which shows the approved page definition: the lead line, the purpose, the quick tasks, and what material to bring. A capability's own page arrives with the platform closing loop, and retargeting its row is one `target` change in `directory/specs.ts`.
- **Two menus of the prototype's three families** — the content-creation tools and the project list are not published yet; they become further groups without any change to the sidebar shell.

**Runtime invariant:** No companion is published. The package retains no mutable state, and its occupants install and leave through `ctx.effect()`: the brand slots through one nested `ctx.slots.inject()`, and the catalogue through one effect that registers and releases every group and panel together.

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.md) — the shell that renders the seats and the catalogue region this package publishes into.
- [ui-layout](../ui-layout/README.md) — the owner of the `main` keyed slot the directory panels register into.
- [locale](../locale/README.md) — the dictionary registry behind both namespaces.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The capability metadata in `src/client/directory/specs.ts` is the single source of the menus: group ids, menu order, panel keys, and each capability's definition rows, with the locale keys computed from the capability id. `src/client/directory/DirectoryPage.tsx` is one template serving both menus, and the group reaches it through the registration's `inject` payload. Adding a menu is one entry in `DIRECTORY_GROUPS` plus its dictionary keys; adding a capability is one id in `AGENT_IDS` or `WORKFLOW_IDS` plus its rows.

</details>
