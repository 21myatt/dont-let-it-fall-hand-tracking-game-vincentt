# Migration notes

Per release tag, newest first. Read by the platform's own version surface
(`GET /platform/versions`) and served to creators' agents through `vincentt
outdated`. Accurate or absent — never speculative. `required: false` is the
authored "no action required," not silence.

## 1.5.8
required: false
No action required.
- A brand-new scaffold's starting scene now runs face tracking only; the hand bounding box still ships but is not mounted. The scene is creator-owned, so an existing project keeps whatever trackers it already mounts.
- The page no longer loads the Poppins font from Google Fonts, because nothing in the template uses it. A project that styled its own text with Poppins now falls back to the system font unless it loads the font itself.
- The page now opens its connection to the platform CDN early, so the tracking files do not wait on connection setup when they are requested.
- Production builds now preload the entry's static script chunks. This is in the build script, which an upgrade does not replace, so only new scaffolds get it.
- The agent contract (AGENTS.md) now says `vincentt create` exits 4 with the `vincentt login` remedy in a folder that already holds an app when there is no account and no terminal, and quotes the preview ending lines without em-dashes, matching the CLI release that ships alongside. AGENTS.md is not replaced by an upgrade, so only new scaffolds get it.
- New scaffolds now start with SDK `2.0.0-alpha.7`; existing projects retain their current SDK pin until they update or reseed.

## 1.5.7
required: false
No action required.
- Release tooling only: the starter now carries two checks for the template's own release tags and its `latest` pointer. They run only in the template repository and do nothing in a creator's project.

## 1.5.6
required: false
No action required.
- The starter's default scene now demonstrates face and hand bounding boxes plus a footer HUD. These are creator-owned files, so upgrading an existing project will not add them; only a brand-new scaffold receives them.
- The starter's agent-contract docs were corrected to point at the SDK's own grounding file instead of a merge step that does not exist. Those docs are not touched by the upgrade either, so this only affects newly-scaffolded projects.

## 1.5.5
required: false
No action required.
- The local preview script now falls back automatically when the platform CLI is not resolvable on the shell's PATH, instead of only printing an install hint.
