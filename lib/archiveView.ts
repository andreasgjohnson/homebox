import { getTextureColor } from '@/lib/theme';

import type { StoreyListItem } from './storeys';

export type ArchiveLens = 'time' | 'themes' | 'people';

export type ArchiveMoment = {
  excerpt: string;
  id: string;
  people: string[];
  primaryTheme: string;
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

const ignoredThemeTags = new Set(['draft', 'recorded', 'uploaded', 'uploading', 'processing']);
const defaultTheme = 'Home';
const defaultTexture = 'Reflective';
const peopleMatchers: Array<[string, RegExp]> = [
  ['Dad', /\b(dad|father)\b/i],
  ['Mom', /\b(mom|mother)\b/i],
  ['Izzy', /\bizzy\b/i],
  ['Johnny', /\bjohnny\b/i],
  ['Friends', /\b(friend|friends)\b/i],
  ['Family', /\bfamily\b/i],
];

export function buildArchiveMoments(storeys: StoreyListItem[]): ArchiveMoment[] {
  return storeys.map((storey) => {
    const tags = getThemeTags(storey.tags);
    const texture = normalizeTexture(storey.emotional_tone);
    const recordedDate = new Date(storey.recorded_at);

    return {
      excerpt: getExcerpt(storey.summary),
      id: storey.id,
      people: inferPeople(`${storey.title ?? ''} ${storey.summary ?? ''} ${tags.join(' ')}`),
      primaryTheme: tags[0] ?? defaultTheme,
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

export function getDashboardInsight(themes: ArchiveAggregate[]) {
  const topTheme = themes[0]?.name ?? defaultTheme;
  return `${topTheme} has been\non your mind.`;
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
  if (!texture || texture === 'Unprocessed') {
    return defaultTexture;
  }

  const known = ['Hopeful', 'Tender', 'Reflective', 'Relaxed', 'Warm', 'Curious', 'Grateful'];
  const matched = known.find((name) => texture.toLowerCase().includes(name.toLowerCase()));

  return matched ?? texture;
}

function getExcerpt(summary: string | null | undefined) {
  if (!summary) {
    return 'Storeybox is still preparing this Storey.';
  }

  return summary.replace(/^["“]|["”]$/g, '').split(/[.!?]\s/)[0] || summary;
}

function inferPeople(text: string) {
  const matches = peopleMatchers
    .filter(([, matcher]) => matcher.test(text))
    .map(([name]) => name);

  return matches.length ? [...new Set(matches)] : [];
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
