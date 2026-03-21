import type { ContextItemInput, ContextWindowItem } from "./types";

const baseSectionWeights: Record<ContextItemInput["section"], number> = {
  systemPrompt: 1.0,
  taskContext: 0.92,
  codeContext: 0.88,
  projectContext: 0.72,
  conversation: 0.65,
};

export function scoreContextItem(
  item: ContextItemInput | ContextWindowItem,
  options: {
    now?: () => Date;
    recencyReference?: string;
  } = {}
): number {
  const relevance = clamp(item.relevance ?? defaultRelevance(item.section), 0, 1);
  const priorityBoost = item.priorityBoost ?? 0;
  const requiredBoost = item.required ? 1.5 : 0;
  const recencyBoost = resolveRecencyBoost(item.updatedAt ?? item.createdAt, options.now);

  return Number(
    (
      baseSectionWeights[item.section] +
      relevance * 0.5 +
      priorityBoost +
      requiredBoost +
      recencyBoost
    ).toFixed(4)
  );
}

export function sortContextItems<T extends ContextItemInput | ContextWindowItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (Boolean(left.required) !== Boolean(right.required)) {
      return left.required ? -1 : 1;
    }

    const scoreDelta = scoreContextItem(right) - scoreContextItem(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return (right.relevance ?? 0) - (left.relevance ?? 0);
  });
}

function resolveRecencyBoost(timestamp: string | undefined, now?: () => Date): number {
  if (!timestamp) {
    return 0;
  }

  const parsedTimestamp = Date.parse(timestamp);
  if (Number.isNaN(parsedTimestamp)) {
    return 0;
  }

  const ageHours = Math.max(
    0,
    ((now ?? (() => new Date()))().getTime() - parsedTimestamp) / 3_600_000
  );
  if (ageHours <= 1) {
    return 0.2;
  }

  if (ageHours <= 24) {
    return 0.12;
  }

  if (ageHours <= 72) {
    return 0.05;
  }

  return 0;
}

function defaultRelevance(section: ContextItemInput["section"]): number {
  switch (section) {
    case "systemPrompt":
      return 1;
    case "taskContext":
      return 0.8;
    case "codeContext":
      return 0.75;
    case "projectContext":
      return 0.6;
    case "conversation":
      return 0.55;
    default:
      return 0.5;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
