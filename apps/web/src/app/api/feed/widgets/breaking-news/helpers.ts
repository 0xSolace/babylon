export interface BreakingNewsWorldEvent {
  eventType: string;
  description: string;
  actors: string[];
  relatedQuestion: number | null;
  pointsToward: string | null;
}

const NEWSWORTHY_WORLD_EVENT_PATTERNS = [
  'announcement',
  'development',
  'scandal',
  'deal',
  'meeting',
  'earnings',
  'news:published',
  'leak',
  'revelation',
  'conflict',
  'merger',
  'acquisition',
  'lawsuit',
  'investigation',
  'probe',
  'breach',
  'hack',
  'sanction',
  'exclusive',
  'resignation',
  'launch',
  'upgrade',
  'partnership',
] as const;

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function isBreakingNewsEvent(event: BreakingNewsWorldEvent): boolean {
  const searchTexts = [
    normalizeText(event.eventType),
    normalizeText(event.description),
    normalizeText(event.pointsToward),
  ];

  if (
    NEWSWORTHY_WORLD_EVENT_PATTERNS.some((pattern) =>
      searchTexts.some((text) => text.includes(pattern))
    )
  ) {
    return true;
  }

  if (event.relatedQuestion !== null) {
    return true;
  }

  return normalizeText(event.pointsToward).length > 0;
}

export function selectSignificantWorldEvents<T extends BreakingNewsWorldEvent>(
  events: readonly T[],
  limit: number
): T[] {
  return events.filter(isBreakingNewsEvent).slice(0, limit);
}
