---
name: Storeybox Home
description: The companion archive for the Storeybox Box — a kept family daybook, read by lamplight.
colors:
  paper-cream: "#F6F2EA"
  page-white: "#FFFFFF"
  warm-page: "#FBF9F4"
  ledger-wash: "#EDF1F4"
  rail: "#EAEFF2"
  ink: "#1E2630"
  charcoal: "#2C3540"
  ink-muted: "#5A6470"
  ink-faint: "#9AA1AB"
  deckle: "#ECE4D5"
  deckle-strong: "#E4DDCF"
  heirloom-gold: "#B88A4E"
  heirloom-gold-deep: "#A9763A"
  ledger-blue: "#5B7895"
  ledger-blue-deep: "#46627E"
  ledger-line: "#CFE0EE"
  ledger-chip: "#E3ECF4"
  dusk-glow: "#C7DCEC"
  red-ink: "#8A3F36"
  red-ink-wash: "#FFF2EF"
  red-ink-border: "#E4B8A8"
  texture-tender: "#B08F8C"
  texture-reflective: "#6B8198"
  texture-relaxed: "#8A9A86"
  texture-curious: "#8A7790"
  texture-unprocessed: "#8A939E"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "46px"
    fontWeight: 300
    lineHeight: "52px"
    letterSpacing: "0"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    letterSpacing: "0"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"
  annotation:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "25px"
  label:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "2.2px"
rounded:
  control: "12px"
  card: "14px"
  card-feature: "18px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-cream}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
    height: "52px"
  button-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 16px"
  card:
    backgroundColor: "{colors.warm-page}"
    rounded: "{rounded.card}"
    padding: "26px"
  chip:
    backgroundColor: "{colors.ledger-chip}"
    textColor: "{colors.ledger-blue-deep}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: Storeybox Home

## 1. Overview

**Creative North Star: "The Daybook by Lamplight"**

Storeybox Home is a kept personal book and the light it is written by. Every element on screen is one of two things: **page** — paper cream surfaces, hairline deckle borders, serif entries, small typewriter marginalia — or **light** — presence rendered as a warm glow, absence as a dark window. The interface reads like a well-loved family daybook: entries accumulate, the binding never changes, and nothing about it feels like software administering recordings.

The system is tender, nostalgic, and handcrafted, but never precious. Density is low and unhurried; screens breathe like generously margined pages. Typography carries the hierarchy that other apps delegate to boxes and dividers: light serif display for what matters, quiet sans for reading, letterspaced mono for the marginalia (eyebrows, counts, footers, provenance).

This system explicitly rejects its neighbors: it is not a voice-memo utility (no waveform-led lists, no file management), not a social feed (no grids, streaks, or engagement pressure), not smart-home gadget UI (device status stays small and subordinate), and not generic SaaS minimalism (nothing here should be mistakable for a dashboard template).

**Key Characteristics:**
- Page-or-light: every element is either printed matter or lamplight; nothing is "chrome."
- Serif-led hierarchy at light weights; mono strictly for marginalia.
- Warm paper field with hairline deckle borders; tinted surfaces over hard containers.
- One ink action color; gold and blue speak rarely and mean something when they do.
- Made for unhurried hands: generous type, 44pt targets, no time pressure.

## 2. Colors

A warm paper field written in ink, with heirloom gold and ledger blue as the two voices in the margins.

### Primary
- **Ink** (#1E2630): the action color and the reading color. Primary buttons, screen titles, active navigation, and body emphasis are all set in Ink — actions in this app are typeset, not colored. **Charcoal** (#2C3540) is its softer companion for secondary text weight.

### Secondary
- **Ledger Blue** (#5B7895): the archive's wayfinding voice. It sits just under 4.5:1 on Paper Cream, so it is reserved for the wordmark (a logotype) and large display uses; **Ledger Blue Deep** (#46627E) carries every small meaningful blue label — eyebrows, links, date stamps, section labels, and text on tinted blue surfaces. **Ledger Line** (#CFE0EE) for input underlines; **Ledger Chip** (#E3ECF4) for chip fills; **Dusk Glow** (#C7DCEC, at ~28% opacity) as the soft atmospheric light behind hero moments.

### Tertiary
- **Heirloom Gold** (#B88A4E): warmth, sparingly — the emotional-texture accent (Hopeful, Warm) and small moments of keeping. **Heirloom Gold Deep** (#A9763A) where gold must sit on paper as text.
- **The texture inks**: Tender (#B08F8C), Reflective (#6B8198), Relaxed / Grateful (#8A9A86), Curious (#8A7790), Unprocessed (#8A939E). Each Storey's emotional texture gets exactly one of these muted inks — dots and small labels, never fields of color.
- **Red Ink** (#8A3F36): corrections and destructive confirmation only, with **Red Ink Wash** (#FFF2EF) and **Red Ink Border** (#E4B8A8). Red ink in a daybook means something went wrong; it never decorates.

### Neutral
- **Paper Cream** (#F6F2EA): the body of every screen — the page itself.
- **Page White** (#FFFFFF) and **Warm Page** (#FBF9F4): raised reading surfaces (cards, entries).
- **Ledger Wash** (#EDF1F4) and **Rail** (#EAEFF2): cool-tinted panels for Box status and structural rails.
- **Ink Muted** (#5A6470): supporting text on paper — the darkest value that still reads as "supporting"; it holds ≥4.5:1 on every surface including the drawer. **Ink Faint** (#9AA1AB): decorative marks and input placeholders' disabled states only, never text the reader must parse — it does not hold 4.5:1 on paper.
- **Deckle** (#ECE4D5) and **Deckle Strong** (#E4DDCF): the hairline borders that do the structural work shadows would do elsewhere.

### Named Rules
**The Page-or-Light Rule.** Every colored element must be justifiable as either printed matter (ink, gold, blue set on paper) or light (glow, presence, playback). If a color exists only to "brand" a surface, it is neither, and it goes.

**The Red-Ink Rule.** The red palette appears only when the user is confirming loss — deletion, unpairing. Never for emphasis, badges, or unread counts.

**The One Lamp Rule.** At most one Dusk Glow per screen, behind the one thing that is present and alive (the Box, playback). Two lamps compete; zero is a page at rest, which is fine.

## 3. Typography

**Display Font:** Newsreader (with Georgia, serif)
**Body Font:** Hanken Grotesk (with system-ui, sans-serif)
**Label/Mono Font:** Space Mono (with ui-monospace, monospace)

**Character:** A literary page with typewriter marginalia. Newsreader at light weights (300) gives headlines the unhurried confidence of a set book page; Hanken Grotesk reads quietly underneath; Space Mono, always small and letterspaced, is the archivist's pencil in the margin.

### Hierarchy
- **Display** (300, 46px / 52px): screen titles — the entry heading of the page. Large sizes always take the 300 weight; Newsreader bold at display size breaks the daybook voice.
- **Headline** (400, 26px): section titles within a page.
- **Title** (400, 21px, serif): navigation entries and list leads — set in serif because they are contents lines, not controls.
- **Body** (400, 16px / 24px, sans): reading text. Ink or Charcoal on paper; Ink Muted for supporting lines only.
- **Annotation** (400 italic, 15px / 25px, serif): the tender voice — subtitles, promises, quoted lines from Storeys.
- **Label** (400, 10–13px, mono, +1.5 to +3.9px letterspacing, uppercase): eyebrows, the wordmark, counts, provenance, footers.

### Named Rules
**The Marginalia Rule.** Space Mono never sets a sentence. It labels, counts, and attributes — three or four words, letterspaced, usually uppercase. The moment mono runs to a full clause, it has left the margin and must become Body.

**The Reading-Size Rule.** These sizes are the floor, not the spec: text must scale with the reader's iOS Dynamic Type setting. This archive's keepers often read at 70; if a layout breaks at the accessibility sizes, the layout is wrong, not the setting.

## 4. Elevation

The page is flat; the light lifts. Structure comes first from hairline Deckle borders and tinted surfaces — ink-on-paper logic. On top of that, this system permits a **soft ambient lift**: interactive surfaces may rise gently on press and focus, and overlays cast wide, diffuse light-borne shadows. Depth is always something lamplight would produce — large radius, low opacity, soft edge — never a hard drop shadow.

### Shadow Vocabulary
- **Page lift** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18)`): the resting or pressed lift for cards and tappable entries. Barely there; the reader feels it more than sees it.
- **Drawer cast** (`box-shadow: 24px 0 60px rgba(28, 34, 42, 0.26)`): the ceiling of the system, reserved for the drawer and full overlays. Nothing else may cast this much shadow.
- **Dusk Glow** (#C7DCEC ellipse at ~28% opacity, ~680×480px, heavily rounded): not a shadow but the system's light — placed behind presence moments per the One Lamp Rule.

### Named Rules
**The Lamplight Rule.** Every shadow must read as cast light: blur radius at least 3× the offset, opacity ≤ 0.26, color drawn from ink (#1C222A family), never pure black at full strength. If a shadow has a visible hard edge, it is a 2014 app, not a daybook.

## 5. Components

Controls follow one doctrine: **typeset ink, lit sparingly**. Ordinary controls are typeset marks on the page — underlined fields, ink buttons, bordered pills, nothing glossy. The few presence actions (play, listen) render as light instead. And nothing in the app ever imitates the Box's physical record button: capture belongs to the hardware alone.

### Buttons
- **Shape:** gently rounded (10–14px today; consolidate on `rounded.control` 12px for controls).
- **Primary:** solid Ink (#1E2630) with Paper Cream text, 48–52px tall, sans 600 at 14–15px. It reads as a typeset plate, not a colored CTA.
- **Pressed / Disabled:** pressed dims to 72% opacity; disabled to 48%. No color shifts — ink doesn't change hue when touched.
- **Secondary (pill):** transparent with a 1px Deckle Strong border, pill radius, Ink text at sans 600 13px. For quiet actions (Sign out, filters).
- **Presence actions (play / listen):** the exception — may carry the Dusk Glow treatment as lamplight. These are the only "lit" controls.

### Chips
- **Style:** Ledger Chip (#E3ECF4) fill, Ledger Blue Deep text, pill radius, no border.
- **Texture dots:** a Storey's emotional texture appears as a small dot or label in its texture ink — never as a filled banner or card tint.

### Cards / Containers
- **Corner Style:** 14px standard, 18px for feature cards (auth, hero entries).
- **Background:** Warm Page (#FBF9F4) or Page White on Paper Cream; Ledger Wash for Box-status panels.
- **Shadow Strategy:** flat at rest with a 1px Deckle border; Page lift on press or focus (see Elevation).
- **Border:** 1px Deckle (#ECE4D5), always. A card without its hairline is a floating rectangle, not an entry.
- **Internal Padding:** generous — 26px in feature cards; never tighter than 16px.

### Inputs / Fields
- **Style:** underline fields — no box, no fill. A 1.5px bottom rule in Ledger Line (#CFE0EE), Ink text; serif at 19px for feature forms (the auth page), sans 16px inline.
- **Label:** small mono or uppercase sans label above, in Ink Faint or Ledger Blue.
- **Focus:** the underline darkens toward Ledger Blue; no glow rings, no border boxes appearing from nowhere.
- **Error:** message set in Red Ink below the rule; the rule itself may shift to Red Ink Border.

### Navigation
- **Top bar:** Paper Cream with a 1px Deckle bottom rule; the letterspaced mono STOREYBOX wordmark in Ledger Blue at center; avatar (Ink circle, Paper Cream initial) at right.
- **Phone:** bottom tab bar (Home, Archive, Your Box, Profile), 1px Deckle top rule, inactive #A6A092, active Ink. Tab icons should be SF Symbols on iOS — the current text glyphs (⌂ ▱ ◉ ◌) are placeholders to replace, and the bar must respect the home-indicator safe area.
- **Wide:** the drawer — a darker paper panel (#F1EDE4) under Drawer cast, serif Title navigation entries, mono section labels, pill sign-out.

### The Box Presence (signature)
The `BoxIllustration` renders the physical Box as a drawn object — layered rounded rectangles, lens, LED ring. It appears wherever the hardware's presence matters (pairing, Your Box, the daybook's presence card), usually under the screen's One Lamp. Status attaches to it as marginalia (mono label + small dot), never as a stats dashboard.

## 6. Do's and Don'ts

### Do:
- **Do** set every action in Ink (#1E2630) and let typography carry hierarchy; a screen should read correctly printed in grayscale.
- **Do** give every card its 1px Deckle (#ECE4D5) hairline and keep shadows within the Lamplight Rule (opacity ≤ 0.26, blur ≥ 3× offset).
- **Do** honor Dynamic Type and keep every tappable target at 44×44pt minimum with breathing room — this app must feel easeful at 70.
- **Do** use SF Symbols for iOS iconography, sized and weighted to the text they sit beside.
- **Do** keep Space Mono to three-or-four-word marginalia, letterspaced, usually uppercase.
- **Do** render emotional textures as muted-ink dots and labels drawn from the texture palette.

### Don't:
- **Don't** build anything that reads as "a voice-memo utility": no waveform-led lists, no file-manager tables, no timestamps as the primary label of a Storey.
- **Don't** borrow from "a social feed": no photo-grid layouts, no streaks, no counts-as-achievements, no engagement nudges or badge dots.
- **Don't** let "smart-home gadget UI" in: device stats, signal meters, and sync spinners stay small, mono, and subordinate to the archive — never a status dashboard.
- **Don't** drift into "generic SaaS minimalism": no interchangeable card grids, no hero-metric tiles, no gradient accents. If a screen could belong to any product, it fails.
- **Don't** imitate the Box's physical record button anywhere in the app, and never reintroduce microphone or capture UI. The Box records; the app remembers.
- **Don't** set body copy in Ink Faint (#9AA1AB) — it fails 4.5:1 on Paper Cream. Faint is for timestamps and labels beside stronger text.
- **Don't** use pure-black hard-edged shadows, colored side-stripe borders, gradient text, or glassmorphism. None of these exist in a daybook.
- **Don't** place more than one Dusk Glow per screen, and never behind static content — light means presence.
