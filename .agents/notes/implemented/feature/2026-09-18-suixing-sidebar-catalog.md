# Agent Note: SuiXing business menus as generic sidebar data

Status: implemented

English | [中文](2026-09-18-suixing-sidebar-catalog.zh.md)

## Problem

The SuiXing distribution needs two collapsible business menus in the sidebar — AI Staff (Agent center) and Automation Factory (WorkFlow center) — with fold memory, a recency budget, search, a "view all" jump, and explicit loading, empty, offline, and error states. Putting those menus in the sidebar shell would push business names and business entries into the base layout, so every later menu and every other distribution would have to edit shell code. The approved prototype also fixes a page definition for each capability — its lead line, purpose, quick tasks, and what material to bring — which has nowhere to live if the menus are presentation code.

## Decision

The sidebar gains a registrant-facing catalog service (`ctx.sidebarCatalog`) and one generic region, and the SuiXing distribution publishes into it.

The shell owns what is generic: the fold state, a recency budget of five rows, per-group search, the view-all jump, entry dispatch, and the four load presentations. A group arrives as data — id, order, title, optional secondary name, entries, optional main-panel key — with titles and labels already localized by the registrant. Nothing about a business name reaches the shell. The service reports `claimed`, so a distribution that publishes no catalog renders no region and no wrapper element at all, keeping the default sidebar DOM unchanged; releasing the last registration (or unloading the plugin) returns it to that state, which is why `claimed` releases with its holder instead of latching.

A catalog entry lives in the inject share of the main slot, not in a hook, because a registrant's payload is static per registration: the shell runs the region against the store's `useCatalog` selector, and the renderer binds the payload the same way it binds every injected face. The directory template is one component serving every menu; the group arrives through the registration's `inject: () => ({ group })`, so a second menu is a registration rather than a page. Both SuiXing menus come from `directory/specs.ts`, whose per-entry keys are computed from the capability id, so a missing dictionary key is a compile error instead of a blank row.

## Alternatives considered

**Name the two menus in the sidebar shell.** The shell would hold SuiXing copy and entries, and the next menu would be another shell edit. The plan forbids hardcoding every entry into the base layout.

**Ship the menus as `sidebar.panellist` entries.** That slot is the shell's own global panel list: one row per panel and no folding, recency, search, or group states. The menus would have needed those affordances added to the shared list, changing the default sidebar for everyone.

**Keep each menu's dictionary and wiring inside the brand package's single namespace.** The two concerns have different lifetimes: the brand is occupied once and never changes, while the directory publishes and releases groups. Separate namespaces let the directory be disposed without touching the brand, and leave room for a third menu.

**Give every capability its own main panel now.** Thirteen panels for thirteen capabilities is the per-capability page the plan's §6.3 template decision rejects. Until a capability's page exists, its row opens its menu's directory, and retargeting is one `target` change.

## Consequences

`ui-sidebar` grows a service, a region component, its styles, and two suites (fold/registry behaviour, and the region's states, search, and dispatch); the package sits at per-file 100% coverage, with the unclaimed state pinned by the panel-list and pointer benches so the default sidebar DOM cannot regress.

`ui-brand-suixing` grows the capability metadata, the directory template, and the published menus, and its `apply()` now also needs `sidebarCatalog`. The menus appear only under the `suixing` build profile, and the package's own renderer test mounts the real slot pipeline to prove a menu's panel key actually serves its directory. The two dictionaries carry the prototype's copy; the dictionary and the spec are checked against each other.

The brand name moved behind the same package's `suixing-brand` namespace in the same round: the client UI i18n gate rejects literals in presentation code, and a proper noun belongs in the dictionary that owns it.

Capability rows currently open their menu's directory, so a click leads to a definition rather than a working page: this is the plan's "definitions first" boundary, not a finished loop. The content-creation tools and the project list are not published yet. The four load states are exercised by the region's own tests; the live platform load and its retry path arrive with the platform closing loop, which is also when the runtime `reportStatus` calls will exist.
