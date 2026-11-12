# Project UI and UX skills

Installed as project-local Agent Skills under `.agents/skills/`. Invoke a skill by name or let the agent select one for relevant UI work. These are portable skill files; the Open Design application, daemon, and MCP server are not installed.

- `frontend-design`: interface design and implementation.
- `design-brief`: structured design requirements.
- `impeccable-design-polish`: review and polish an existing interface.
- `baseline-ui`: spacing, hierarchy, typography, and component guidance.
- `fixing-accessibility`: keyboard, focus, semantics, and contrast.
- `fixing-motion-performance`: efficient animation and reduced motion.
- `create-design-md`: document a reusable design system.

Open Design craft references are retained in `_open-design-craft/`. This directory is supporting material, not a separate skill. Original skill licenses are included. `sources.json` records source revisions.

For this extension, preserve its existing vanilla JavaScript architecture and strict CSP. Apply stack-specific recommendations only where compatible; installing skills does not authorize adding React, Tailwind, remote fonts, or remote scripts. Keep design references and skills out of runtime packages; `build.js` already packages an explicit file whitelist.

Official additions: `frontend-design` (Anthropic upstream replaces the Open Design adaptation), `design-system` (Anthropic), `impeccable` (full skill, references and launcher), and `logo-design` (full scripts and reference library). Impeccable may download its companion binary on first use; installing the skill does not run project initialization.

Additional upstream bundles: `taste-skill` (Leonxlnx/taste-skill, including assets and references) and `ui-ux-pro-max` (nextlevelbuilder, including the Python search helper, data and references). UI/UX Pro Max launcher examples have been adapted to this checkout’s project-local skill directory. These packages are developer tools, not extension runtime assets.
