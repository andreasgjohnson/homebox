---
target: home
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-07-10T21-47-32Z
slug: app-app-index-tsx
---
**Method: dual-agent (A: a050fe6d82084ad6a · B: a9420d9356033b23a)** · Browser/overlay evidence skipped — home is auth-gated behind magic-link login; reviewed from source.

# Critique: Home ("the daybook") — app/(app)/index.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Mid-page spinner on every focus; return shelf shows false "first Storey" copy during load |
| 2 | Match System / Real World | 3 | Warm language, but "Dashboard" label and raw backend errors leak jargon |
| 3 | User Control and Freedom | 2 | No retry on error, no pull-to-refresh; tabs router.replace so state never preserved |
| 4 | Consistency and Standards | 2 | ~25 off-token hex literals; Home/Dashboard naming split; tappable vs static analytics columns identical |
| 5 | Error Prevention | 3 | Read-only surface, little to prevent |
| 6 | Recognition Rather Than Recall | 3 | Labeled tabs/links; analytics tappability has no affordance |
| 7 | Flexibility and Efficiency | 2 | Deep links only accelerator; no refresh, one rigid path |
| 8 | Aesthetic and Minimalist Design | 2 | One screen doing ~5 jobs across 9 bands; same Storey shown twice |
| 9 | Error Recovery | 1 | Supabase error.message verbatim in red, no recovery action |
| 10 | Help and Documentation | 2 | Empty states teach; nothing contextual beyond |
| **Total** | | **22/40** | **Acceptable** |

## Anti-Patterns Verdict

Not AI slop — earned, consistent voice (serif hierarchy, deckle hairlines, texture-dot marginalia, zero gamification; voice-memo-utility and social-feed anti-references cleanly avoided). Three infections:

1. **Eyebrow saturation**: 7 distinct eyebrow-style mono labels, 8+ instances on one screen (FOR TONIGHT, RECENT STOREYS, FROM YOUR ARCHIVE, TOP THEME, LATEST TEXTURE, WHO CAME UP, stamps, presence subs). At this density the sanctioned marginalia system becomes the banned AI-grammar cadence; section labels indistinguishable from data labels.
2. **Analytics band = hero-metric grid wearing serif** (index.tsx:223): big value, kicker, count, ×3 in a tinted band. DESIGN.md bans hero-metric tiles; PRODUCT.md: "a daybook, not a dashboard."
3. **Marginalia Rule self-violation**: Space Mono sets full sentences (footer "Your story stays yours.", drawer, Box subs "IT WILL SYNC WHEN IT RECONNECTS").

Deterministic scan: detect.mjs parsed native files, 4 advisory design-system-color findings (index.tsx:602, DaybookChrome.tsx:507, BoxHardware.tsx:265,277); grep found ~25 unique off-token hexes (incl. #5A6470 inlining colors.muted; #EAF1F7 near-miss of surfaceBlue). Audit-fix pass confirmed holding: zero side-stripes, zero lineHeight==fontSize, tab bar inset-aware, one unlabeled Pressable remaining (drawer scrim). New finding: **recording state fails contrast** — #C0883F title 2.71:1, #C07030 sub 3.31:1 on washed warm card.

## Overall Impression

Bones right, writing often lovely, but Home inverts its own doctrine: opens with a ~230pt hardware card, passes through a stat grid, and the "for tonight" peak is storeys[0] duplicated as the first row of the list below. Biggest opportunity: make Home an actual page of the daybook — greeting, one genuinely curated Storey under the lamp, quiet close — and move analysis to Archive.

## What's Working

1. Box-state copy is the best writing in the app (lib/box.ts:39–84) — hardware states reframed as care.
2. The return shelf is the right centerpiece concept; only the curation logic betrays it.
3. Anti-reference discipline holds: timestamps as marginalia, textures as ink dots, no gamification.

## Priority Issues

- **[P1] Home opens on a dashboard: hardware leads, memory follows.** Presence card is first/largest (index.tsx:120); bottom half is insight band + stat grid; the One Lamp glows on idle hardware. Fix: compress Box presence to BoxStatusBadge scale under the greeting (full card for Your Box + recording state); lead with the return shelf and move the Dusk Glow to it; relocate analytics to Archive. → /impeccable layout (+ distill)
- **[P1] "For tonight" is the newest item, shown twice.** returnStorey = recentStoreys[0] (index.tsx:82); shelf duplicates the first recents row. Fix: real rediscovery pick (seeded daily, older than N days, anniversary matching), excluded from recents, honestly labeled ("FROM LAST OCTOBER"). → /impeccable shape
- **[P1] Every tab return demolishes the page.** Tabs router.replace (DaybookChrome.tsx:305) → remount → refetch → mid-page spinner → shift; shelf shows false empty copy during load. Fix: expo-router Tabs, cached data + silent refresh, skeletons, never empty copy while loading. → /impeccable optimize
- **[P2] The archive invents data.** normalizeTexture rewrites Unprocessed→Reflective (archiveView.ts:212); WHO CAME UP fed by hardcoded regexes incl. names 'Izzy'/'Johnny' (archiveView.ts:41); system copy typeset inside quotation marks. Fix: honest Unprocessed ink, hide WHO CAME UP until real extraction, quotes only for true excerpts. → /impeccable harden
- **[P2] Errors raw and dead-ended.** error.message verbatim (index.tsx:159), no retry. Fix: voice-true copy + quiet Retry pill. → /impeccable clarify
- **[P2] Recording state fails contrast** (2.71:1 / 3.31:1) at the app's most sacred moment. Fix: darken recording golds toward goldDark, verify ≥4.5:1. → /impeccable polish

## Persona Red Flags

- **Casey**: scroll position lost on every tab glance; "All →" ~39pt effective (<44pt) and is the only archive path from the section; tappable analytics columns identical to static one.
- **Sam (VoiceOver)**: empty return shelf is a disabled button in swipe order; texture dot row is color-only, unlabeled; error notice not a live region; 10px meta below the 11pt floor.
- **Margaret, 72 (keeper)**: "FOR TONIGHT" above "Good morning" at 10am; duplicate Storey reads as her mistake; 13px italic excerpts below DESIGN.md's 15px annotation floor; "WHO CAME UP: Johnny" — a stranger's name in her family archive; greeting can address her as her email.

## Minor Observations

- Mono sentences violate the Marginalia Rule (footer, drawer, Box subs).
- ~25 off-token hexes; drawer scrim Pressable unlabeled.
- Drawer "Dashboard" vs tab "Home"; "Collections" and "Archive" → same route.
- Profile tab push vs others replace — inconsistent back behavior.
- returnHairline neither page nor light.
- 46px Display level never used on the front page; greeting is 15px muted italic.
- "All →" text arrow instead of chevron.right.
- Observation line and TOP THEME state the same fact twice.
- amberPulse/"breathing" styles static — nothing animates (known deferred).
- Native fonts still system until in-flight fix lands.

## Questions to Consider

1. Who deserves the lamp — idle hardware, or tonight's Storey?
2. If the observation band, stat grid, and deep links moved to Archive tomorrow, would anyone miss them on Home? If not, Home could be typeset as an actual dated page.
3. What does the shelf offer on night 400 — should "for tonight" be memory-shaped (anniversaries, seasons, unheard voices), and where does that editorial logic live?
