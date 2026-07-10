# Storeybox Home

Companion iPhone/Expo app for the Storeybox Box (hardware-first memory archive). See [README.md](README.md) for architecture, product language, and the core product rule: **the Box records; the app does not** — never reintroduce capture UI.

## Design Context

- [PRODUCT.md](PRODUCT.md) — strategic context: register (product), platform (ios), users, positioning, brand personality, anti-references, design principles. Read it before any UI/design work.
- [DESIGN.md](DESIGN.md) — the visual system ("The Daybook by Lamplight"): color tokens, typography, elevation, components, and do's/don'ts. Tokens in the YAML frontmatter are normative and mirror [lib/theme.ts](lib/theme.ts).
- UI changes should honor both files; when code and DESIGN.md disagree, treat theme.ts as the source of truth for values and DESIGN.md for intent, and flag the drift.
