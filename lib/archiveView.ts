import { getTextureColor } from '@/lib/theme';

import { getStoreyProvenance, type StoreyListItem } from './storeys';

export type ArchiveLens = 'time' | 'themes' | 'people';

export type ArchiveMoment = {
  excerpt: string;
  id: string;
  people: string[];
  primaryTheme: string;
  provenanceLabel: string;
  recordedAt: string;
  recordedDate: Date;
  stamp: string;
  tags: string[];
  texture: string;
  textureColor: string;
  title: string;
};

export type ArchiveAggregate = {
  color: string;
  count: number;
  initial?: string;
  name: string;
};

export type ArchivePeriod = {
  color: string;
  count: number;
  highlights: ArchiveMoment[];
  label: string;
  sub: string;
  themes: string;
};

export type ShelfPick = {
  label: string;
  storey: ArchiveMoment;
};

const ignoredThemeTags = new Set(['draft', 'recorded', 'uploaded', 'uploading', 'processing']);
const defaultTheme = 'Home';
const defaultTexture = 'Unprocessed';

export function buildArchiveMoments(storeys: StoreyListItem[]): ArchiveMoment[] {
  return storeys.map((storey) => {
    const tags = getThemeTags(storey.tags);
    const texture = normalizeTexture(storey.emotional_tone);
    const recordedDate = new Date(storey.recorded_at);

    return {
      excerpt: getExcerpt(storey.summary),
      id: storey.id,
      // People stay empty until processing produces real entity extraction
      // (docs/DEFERRED_FEATURES.md); the archive never guesses names.
      people: [],
      primaryTheme: tags[0] ?? defaultTheme,
      provenanceLabel: getStoreyProvenance(storey).label,
      recordedAt: storey.recorded_at,
      recordedDate,
      stamp: formatStoreyStamp(storey.recorded_at),
      tags,
      texture,
      textureColor: getTextureColor(texture),
      title: storey.title || 'Untitled Storey',
    };
  });
}

export function getThemeAggregates(moments: ArchiveMoment[]) {
  const counts = new Map<string, { color: string; count: number; name: string }>();

  moments.forEach((moment) => {
    const tags = moment.tags.length ? moment.tags : [defaultTheme];

    tags.forEach((tag) => {
      const current = counts.get(tag) ?? { color: moment.textureColor, count: 0, name: tag };
      counts.set(tag, { ...current, count: current.count + 1 });
    });
  });

  return sortAggregates([...counts.values()]);
}

export function getPersonAggregates(moments: ArchiveMoment[]) {
  const counts = new Map<string, ArchiveAggregate>();

  moments.forEach((moment) => {
    moment.people.forEach((person) => {
      const current = counts.get(person) ?? {
        color: getTextureColor('Tender'),
        count: 0,
        initial: person.slice(0, 1).toUpperCase(),
        name: person,
      };
      counts.set(person, { ...current, count: current.count + 1 });
    });
  });

  return sortAggregates([...counts.values()]);
}

export function getTimeAggregates(moments: ArchiveMoment[]) {
  const counts = new Map<string, ArchiveAggregate>();

  moments.forEach((moment) => {
    const label = formatMonthYear(moment.recordedDate);
    const current = counts.get(label) ?? {
      color: moment.textureColor,
      count: 0,
      name: label,
    };
    counts.set(label, { ...current, count: current.count + 1 });
  });

  return [...counts.values()];
}

export function getArchivePeriods(moments: ArchiveMoment[]) {
  if (!moments.length) {
    return [];
  }

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const buckets = new Map<string, ArchiveMoment[]>();

  moments.forEach((moment) => {
    const date = moment.recordedDate;
    let label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
    let sub = new Intl.DateTimeFormat(undefined, { year: 'numeric' }).format(date);

    if (date >= weekAgo) {
      label = 'This week';
      sub = getWeekRangeLabel(weekAgo, now);
    } else if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
      label = `Earlier in ${new Intl.DateTimeFormat(undefined, { month: 'long' }).format(now)}`;
      sub = `${new Intl.DateTimeFormat(undefined, { month: 'short' }).format(now)} 1-${now.getDate() - 7}`;
    }

    const key = `${label}|${sub}`;
    buckets.set(key, [...(buckets.get(key) ?? []), moment]);
  });

  return [...buckets.entries()].map(([key, bucket]) => {
    const [label, sub] = key.split('|');
    const themes = getThemeAggregates(bucket)
      .slice(0, 3)
      .map((theme) => theme.name)
      .join(' · ');

    return {
      color: bucket[0]?.textureColor ?? getTextureColor(defaultTexture),
      count: bucket.length,
      highlights: bucket.slice(0, 2),
      label,
      sub,
      themes: themes || defaultTheme,
    };
  });
}

const dayMs = 24 * 60 * 60 * 1000;
const numberWords: Record<number, string> = {
  2: 'TWO',
  3: 'THREE',
  4: 'FOUR',
  5: 'FIVE',
  6: 'SIX',
  7: 'SEVEN',
  8: 'EIGHT',
};

/**
 * The daybook shelf: a deterministic daily rediscovery pick. Same archive +
 * same calendar day = same Storey, so the shelf reads as something set out
 * for today rather than a feed. Ladder: anniversary match → any Storey at
 * least 14 days old → the oldest Storey that isn't the newest → the only
 * Storey, honestly labeled.
 */
export function getShelfPick(moments: ArchiveMoment[], now = new Date()): ShelfPick | null {
  if (!moments.length) {
    return null;
  }

  if (moments.length === 1) {
    return { label: 'YOUR FIRST STOREY', storey: moments[0] };
  }

  const seed = hashString(formatSeedDate(now));
  const byNewest = [...moments].sort(
    (a, b) => b.recordedDate.getTime() - a.recordedDate.getTime(),
  );
  const newestId = byNewest[0].id;

  const anniversaries = moments.filter((moment) => getAnniversaryYears(moment.recordedDate, now) >= 1);

  if (anniversaries.length) {
    const pick = anniversaries[seed % anniversaries.length];
    const years = getAnniversaryYears(pick.recordedDate, now);

    return {
      label:
        years === 1 ? 'A YEAR AGO THIS WEEK' : `${numberWords[years] ?? years} YEARS AGO THIS WEEK`,
      storey: pick,
    };
  }

  const rested = moments.filter(
    (moment) => now.getTime() - moment.recordedDate.getTime() >= 14 * dayMs,
  );

  if (rested.length) {
    const pick = rested[seed % rested.length];

    return { label: formatShelfAge(pick.recordedDate, now), storey: pick };
  }

  const oldest = [...byNewest].reverse().find((moment) => moment.id !== newestId);

  return oldest ? { label: 'FROM YOUR FIRST WEEK', storey: oldest } : null;
}

function getAnniversaryYears(recorded: Date, now: Date) {
  const years = now.getFullYear() - recorded.getFullYear();

  if (years < 1) {
    return 0;
  }

  const anniversary = new Date(recorded);
  anniversary.setFullYear(recorded.getFullYear() + years);

  return Math.abs(anniversary.getTime() - now.getTime()) <= 3 * dayMs ? years : 0;
}

function formatShelfAge(recorded: Date, now: Date) {
  const days = Math.floor((now.getTime() - recorded.getTime()) / dayMs);

  if (days < 60) {
    const weeks = Math.max(2, Math.round(days / 7));

    return `FROM ${numberWords[weeks] ?? weeks} WEEKS AGO`;
  }

  const month = new Intl.DateTimeFormat(undefined, { month: 'long' })
    .format(recorded)
    .toUpperCase();
  const yearDiff = now.getFullYear() - recorded.getFullYear();

  if (yearDiff === 0) {
    return `FROM ${month}`;
  }

  if (yearDiff === 1 && days < 366) {
    return `FROM LAST ${month}`;
  }

  return `FROM ${month} ${recorded.getFullYear()}`;
}

function formatSeedDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function hashString(value: string) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return Math.abs(hash);
}

/**
 * The observation line speaks only when the archive has something real to
 * say: a theme carried by actual tags on at least two Storeys. Otherwise it
 * stays silent rather than inventing a pattern.
 */
export function getDashboardInsight(moments: ArchiveMoment[]) {
  const counts = new Map<string, number>();

  moments.forEach((moment) => {
    moment.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (!top || top[1] < 2) {
    return null;
  }

  return `${top[0]} has been on your mind.`;
}

export function getFirstName(nameOrEmail: string | null | undefined) {
  if (!nameOrEmail) {
    return 'there';
  }

  return nameOrEmail.split('@')[0].trim().split(/\s+/)[0] || 'there';
}

export function toSlug(value: string) {
  return encodeURIComponent(value.toLowerCase().replace(/\s+/g, '-'));
}

export function fromSlug(value: string | string[] | undefined) {
  return decodeURIComponent(Array.isArray(value) ? value[0] : value ?? '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getThemeTags(tags: string[] | null | undefined) {
  return (tags ?? [])
    .map(toDisplayLabel)
    .filter((tag) => tag && !ignoredThemeTags.has(tag.toLowerCase()));
}

function toDisplayLabel(value: string) {
  const label = value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

  if (label.toLowerCase() === 'local') {
    return defaultTheme;
  }

  return label;
}

function normalizeTexture(texture: string | null | undefined) {
  // Honesty over polish: an unprocessed Storey shows as Unprocessed in its
  // own ink, never a fabricated emotional reading.
  if (!texture || texture === 'Unprocessed') {
    return defaultTexture;
  }

  const known = ['Hopeful', 'Tender', 'Reflective', 'Relaxed', 'Warm', 'Curious', 'Grateful'];
  const matched = known.find((name) => texture.toLowerCase().includes(name.toLowerCase()));

  return matched ?? texture;
}

// Empty when processing hasn't produced a summary yet; renderers show an
// unquoted "still being prepared" line instead. Quotation marks are reserved
// for the keeper's actual words.
function getExcerpt(summary: string | null | undefined) {
  if (!summary) {
    return '';
  }

  return summary.replace(/^["“]|["”]$/g, '').split(/[.!?]\s/)[0] || summary;
}

function sortAggregates<T extends { count: number; name: string }>(items: T[]) {
  return items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function formatStoreyStamp(value: string) {
  const date = new Date(value);
  const monthDay = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${monthDay} · ${time}`.toUpperCase();
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getWeekRangeLabel(start: Date, end: Date) {
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(end);
  return `${month} ${start.getDate()}-${end.getDate()}`;
}
