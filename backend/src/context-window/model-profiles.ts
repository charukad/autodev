import type {
  ContextBudgetOverride,
  ContextModelId,
  ContextModelProfile,
  ContextSectionAllocations,
  ResolvedContextBudget,
} from "./types";

const defaultSectionAllocations: ContextSectionAllocations = {
  systemPrompt: 0.08,
  projectContext: 0.12,
  taskContext: 0.12,
  codeContext: 0.33,
  conversation: 0.20,
  response: 0.15,
};

const defaultProfiles: ContextModelProfile[] = [
  createProfile("gpt-4o-mini", 128_000, 10_000, 4.1),
  createProfile("gpt-4o", 128_000, 12_000, 4.0),
  createProfile("gpt-4", 128_000, 12_000, 4.0),
  createProfile("o1", 200_000, 16_000, 3.9),
  createProfile("o3", 200_000, 16_000, 3.9),
  createProfile("claude-3-haiku", 200_000, 12_000, 3.6),
  createProfile("claude-3.5-sonnet", 200_000, 14_000, 3.6),
  createProfile("claude-3-opus", 200_000, 14_000, 3.6),
  createProfile("claude-4", 200_000, 16_000, 3.6),
];

export class ContextBudgetRegistry {
  private readonly profiles = new Map<ContextModelId, ContextModelProfile>(
    defaultProfiles.map((profile) => [profile.model, structuredClone(profile)])
  );

  setModelProfile(profile: ContextModelProfile): void {
    this.profiles.set(profile.model, structuredClone(profile));
  }

  listProfiles(): ContextModelProfile[] {
    return [...this.profiles.values()].map((profile) => structuredClone(profile));
  }

  resolveProfile(model: ContextModelId): ContextModelProfile {
    const exact = this.profiles.get(model);
    if (exact) {
      return structuredClone(exact);
    }

    const normalizedModel = model.toLowerCase();
    const partial =
      [...this.profiles.values()].find((profile) => normalizedModel.startsWith(profile.model.toLowerCase())) ??
      [...this.profiles.values()].find((profile) => normalizedModel.includes(profile.model.toLowerCase()));

    return structuredClone(partial ?? this.profiles.get("gpt-4o")!);
  }

  resolveBudget(
    model: ContextModelId,
    override: ContextBudgetOverride | undefined,
    maxAvailableTokens?: number
  ): ResolvedContextBudget {
    const profile = this.resolveProfile(model);
    const totalTokens = Math.max(
      1,
      Math.floor(
        Math.min(
          override?.totalTokens ?? profile.contextWindowTokens,
          maxAvailableTokens ?? Number.POSITIVE_INFINITY
        )
      )
    );

    const requestedResponseTokens =
      override?.responseTokens ??
      Math.floor(
        totalTokens * (override?.sectionAllocations?.response ?? profile.sectionAllocations.response)
      );
    const responseTokens = clamp(
      requestedResponseTokens,
      Math.min(256, totalTokens),
      totalTokens - Math.min(1_024, totalTokens - 1)
    );
    const remainingTokens = Math.max(1, totalTokens - responseTokens);
    const mergedAllocations = {
      ...profile.sectionAllocations,
      ...(override?.sectionAllocations ?? {}),
      response: responseTokens / totalTokens,
    };
    const contentSections = [
      "systemPrompt",
      "projectContext",
      "taskContext",
      "codeContext",
      "conversation",
    ] as const;
    const allocationSum = contentSections.reduce(
      (sum, section) => sum + Math.max(0, mergedAllocations[section]),
      0
    );

    let consumed = 0;
    const sectionTokens = contentSections.reduce<ResolvedContextBudget["sectionTokens"]>(
      (accumulator, section, index) => {
        const ratio =
          allocationSum > 0 ? Math.max(0, mergedAllocations[section]) / allocationSum : 1 / contentSections.length;
        const sectionBudget =
          index === contentSections.length - 1
            ? remainingTokens - consumed
            : Math.max(0, Math.floor(remainingTokens * ratio));
        accumulator[section] = sectionBudget;
        consumed += sectionBudget;
        return accumulator;
      },
      {
        systemPrompt: 0,
        projectContext: 0,
        taskContext: 0,
        codeContext: 0,
        conversation: 0,
      }
    );

    return {
      model,
      totalTokens,
      responseTokens,
      sectionTokens,
    };
  }
}

export function getDefaultContextBudgetRegistry(): ContextBudgetRegistry {
  return new ContextBudgetRegistry();
}

function createProfile(
  model: ContextModelId,
  contextWindowTokens: number,
  defaultResponseTokens: number,
  charsPerToken: number
): ContextModelProfile {
  return {
    model,
    contextWindowTokens,
    defaultResponseTokens,
    charsPerToken,
    sectionAllocations: structuredClone(defaultSectionAllocations),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

