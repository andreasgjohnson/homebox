# Deferred Features

Features that were visible in the UI as dead controls or fabricated data, removed during the
July 2026 iOS audit-fix pass ("hide until real"). Each one is wanted — reintroduce it when its
backend and data actually exist, not before. The rule that governed the removals is in
[DESIGN.md](../DESIGN.md): the archive never fabricates memories, and nothing looks tappable
unless it does something.

## Wanted features (removed as dead controls)

- **Archive export** — profile had an "Export your archive → Request" row with no behavior
  (`app/(app)/profile.tsx`). Needs a server-side export job and a delivery mechanism.
- **Trusted contacts / legacy settings** — profile had a "Trusted contacts — coming later"
  section ("Legacy settings", "Trusted contact"). A real feature for an heirloom product;
  needs schema and flows.
- **Notification preferences** — Your Box had three static toggle lookalikes ("A Storey is
  ready to revisit", "A new Storey has arrived", "A prompt waiting at home")
  (`app/(app)/your-box.tsx`), and profile had a read-only "Notifications" section. Needs push
  infrastructure and per-user preference storage.
- **Edit themes / Add a person / Download** — three action pills on the Storey detail screen
  (`app/(app)/archive/[id].tsx`) rendered as non-interactive Views. Editing tags/people needs
  write paths; download needs signed-URL export.

## Wanted features (removed as fabricated data)

- **Waveform with marked moments** — the Storey detail waveform was a hardcoded bar array with
  fake gold "pins" that seeked to invented timestamps. Replaced with a real playback progress
  track. A real waveform needs amplitude data from processing; tappable marked moments need
  per-quote timestamps from the transcription pipeline.
- **Reflection trends ("How often you reflect on X")** — people/themes detail pages rendered a
  fixed six-month bar chart with a fabricated takeaway sentence
  (`app/(app)/people/[name].tsx`, `app/(app)/themes/[name].tsx`). Needs real per-month
  aggregation over `recorded_at`.
- **Texture-over-time panel** — people detail showed a fake Jan–Jun texture dot row with an
  invented narrative sentence. Needs real per-period texture aggregation.
- **"Storeybox noticed" reflections** — people detail ended with a hardcoded insight paragraph.
  A real version needs an insight-generation step in processing.
- **Recent searches** — archive search showed three hardcoded entries
  (`app/(app)/archive/search.tsx`). Needs local persistence of actual searches.
- **Per-Storey durations in lists** — home and detail-page cards showed hardcoded "2:14" /
  "3:48". Needs duration captured at upload/processing time and stored on the Storey row.
- **Time-period grouping on theme pages** — "This month" / "Earlier this spring" dividers were
  fabricated; the moment list wasn't actually grouped by time. Needs real period bucketing
  (the archive index's time lens already has `getArchivePeriods` to reuse).
