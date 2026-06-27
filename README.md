# Storeybox Home

Storeybox Home, also called the home box app, is a private voice-first memory
archive. It helps someone capture small spoken memories, then turns those
recordings into a calm personal archive with transcripts, summaries, themes,
emotional texture, memorable quotes, people, and time-based views.

This README is written as context you can give to ChatGPT when brainstorming
new, different features for the app.

## ChatGPT Brainstorming Context

You are brainstorming features for Storeybox Home, a private memory preservation
app. The product is not a generic notes app, social app, journaling streak app,
or productivity tool. It should feel like a quiet heirloom archive: personal,
emotionally intelligent, private by default, and useful over years.

The current app lets a person record audio memories. After recording, the app
uploads the private audio, transcribes it with AI, generates a human title and
summary, extracts tags/themes, identifies an emotional tone, and saves memorable
quotes. The user can browse their archive by time, by theme, and by people who
come up in memories. The home screen offers a reflective dashboard insight such
as "Home has been on your mind" based on recent recordings.

The app's emotional promise is:

- Your story stays yours.
- Your memories become easier to revisit without becoming performative.
- The app helps you notice patterns in your life, relationships, places, and
  feelings.
- It should preserve the user's voice and life context, not flatten everything
  into generic AI summaries.

The best feature ideas should respect privacy, intimacy, and long-term memory.
Avoid ideas that turn the app into social media, gamified productivity, public
sharing, ads, engagement bait, or a cluttered dashboard.

## Product Shape

Storeybox Home is built around a few core moments:

1. A new user is welcomed by Storey, the app's warm guide, and prompted to say
   hello.
2. That first hello recording stays local until the user verifies an email magic
   link.
3. Once signed in, the hello becomes the first private memory in the archive.
4. The user can record more memories from the home screen.
5. Each memory becomes audio playback, transcript, summary, title, emotional
   tone, tags, and memorable quotes.
6. The archive reorganizes those memories into time, theme, and people views.

The product is currently focused on web and Expo app experiences, with a calm
visual language: warm paper backgrounds, blue-gray archive tones, subtle gold
accents, serif display type, quiet mono labels, and spacious heirloom-style
layouts.

## Current User-Facing Features

- Magic-link authentication through Supabase.
- First-memory onboarding flow that records before signup, waits for email
  verification, then finalizes the memory after authentication.
- Audio recording with microphone permissions.
- Private audio upload to Supabase Storage.
- AI transcription and memory summarization through a Supabase Edge Function.
- Memory detail page with audio playback, title editing, summary, transcript,
  emotional tone, tags, memorable quotes, and delete support.
- Home dashboard with greeting, reflective insight, prominent record action,
  recent memories, top theme, texture, and person surfaced from the archive.
- Memories index with three lenses: time, themes, and people.
- Theme detail pages showing memories connected to a theme plus trend-style
  panels.
- Person detail pages showing memories connected to a person plus reflective
  pattern panels.
- Profile settings for first name, last name, and private profile photo.
- Responsive layouts for phone and wider desktop/tablet screens.

## Current Data Model

The main database tables are:

- `profiles`: one row per user, with display name, first name, last name, and
  optional avatar path.
- `memories`: one row per memory, with title, summary, transcript,
  emotional tone, tags, memorable quotes, audio path, recorded date, and created
  date.

Audio is stored in a private `memory-audio` Supabase Storage bucket. Profile
photos are stored in a private `profile-photos` bucket. Row-level security and
storage policies restrict users to their own data.

## Current AI Behavior

The app uses a Supabase Edge Function named `process-memory`.

The function:

- Verifies the signed-in user.
- Confirms the memory belongs to that user.
- Confirms the audio path is inside that user's private archive.
- Downloads the audio from private storage.
- Uses OpenAI audio transcription.
- Uses an OpenAI chat model to produce structured memory metadata.
- Saves title, summary, transcript, emotional tone, tags, and memorable quotes
  back to the memory.

The summarizer is instructed to use warm plain language, avoid invented details,
write directly to the account owner in second person, and keep titles specific
and human.

## Existing Archive Concepts

The app already has a few lightweight interpretation concepts:

- Theme: derived from AI-generated tags, normalized into readable labels.
- Texture: derived from emotional tone, with known values such as Hopeful,
  Tender, Reflective, Relaxed, Warm, Curious, and Grateful.
- People: currently inferred from memory text with a simple matcher for names
  and family terms.
- Time periods: recent memories are grouped into "This week," "Earlier in
  [month]," and month/year archive periods.
- Dashboard insight: based on the top recurring theme.

These are early patterns, not finished product boundaries. Feature ideas can
deepen them.

## Feature Brainstorming Directions

Strong ideas for this app may involve:

- Helping users ask better questions of loved ones.
- Turning memories into gentle timelines, relationship maps, or life chapters.
- Letting users revisit past memories at meaningful moments.
- Detecting recurring places, people, themes, rituals, seasons, or unresolved
  questions.
- Preserving voice, accents, phrases, and original audio as first-class memory
  material.
- Creating private prompts that respond to the user's actual archive.
- Supporting families without making the archive public or social by default.
- Adding export, inheritance, legacy, or trusted-contact flows.
- Improving search and retrieval across transcripts, quotes, people, dates, and
  feelings.
- Making the AI feel like a careful archivist rather than a chatbot companion.

Weak ideas for this app include:

- Public feeds, likes, followers, comments, or viral sharing.
- Streak pressure or productivity gamification.
- Generic journaling prompts unrelated to the user's archive.
- AI that invents memories or over-interprets sensitive events.
- Busy analytics dashboards that make personal memories feel clinical.

## Useful Prompt To Give ChatGPT

```text
I am building Storeybox Home, a private voice-first memory archive. It records
spoken memories, uploads the private audio, transcribes it, summarizes it, and
organizes memories by time, theme, emotional texture, memorable quotes, and
people. It should feel like a quiet heirloom archive, not a social app,
productivity app, or generic journaling app.

Current features include magic-link auth, first-memory onboarding, private audio
storage, AI transcription/summarization, a home dashboard with reflective
insights, memory detail pages with playback/transcript/quotes, archive lenses
for time/themes/people, theme and person detail pages, and profile settings.

Brainstorm new, different product features that deepen the app's purpose:
private memory preservation, noticing life patterns, revisiting relationships,
preserving voice, and helping people create a meaningful archive over years.
Prioritize ideas that are emotionally resonant, privacy-preserving, practical to
build, and meaningfully different from ordinary notes or journaling apps. Avoid
social feeds, engagement bait, generic prompts, or features that make memories
feel performative.
```

## Technical Stack

- Expo Router
- React Native / React Native Web
- TypeScript
- Supabase Auth, Postgres, Storage, Row Level Security, and Edge Functions
- OpenAI transcription and summary generation
- Netlify for hosted web beta builds

## Local Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and enter the project's URL and anon key.
3. Apply the Supabase migrations in `supabase/migrations`.
4. Set the OpenAI API key as a Supabase Edge Function secret:
   `supabase secrets set OPENAI_API_KEY=sk-...`.
5. Deploy the processor:
   `supabase functions deploy process-memory`.
6. In Supabase Auth settings, enable email magic links and add local/deployed web
   URLs to the allowed redirect URLs.
7. Install dependencies with `pnpm install`.
8. Start the app with `pnpm start`.

Never put the Supabase service-role key or OpenAI API key in an
`EXPO_PUBLIC_*` variable. OpenAI calls belong inside
`supabase/functions/process-memory`.
