import type { JsonValue } from "@ai-office/shared";
import type { ManagedTask } from "../agents";
import { RagPipeline } from "./rag-pipeline";
import type {
  RagTaskEnrichmentInput,
  RagTaskEnrichmentResult,
  RagToolMutationInput,
} from "./types";

export class RagMiddleware {
  constructor(private readonly pipeline: RagPipeline = new RagPipeline()) {}

  async enrichTaskInput(
    input: RagTaskEnrichmentInput
  ): Promise<RagTaskEnrichmentResult | undefined> {
    const query = deriveQuery(input.task);
    if (!query) {
      return undefined;
    }

    await this.pipeline.ensureIndexed({
      sessionId: input.sessionId,
      projectRoot: input.projectRoot,
    });
    const rag = await this.pipeline.assembleContext({
      sessionId: input.sessionId,
      projectRoot: input.projectRoot,
      query,
      model: input.model ?? "gpt-4o",
      ...(input.budgetOverride ? { budgetOverride: input.budgetOverride } : {}),
      ...(input.retrieval ? { retrieval: input.retrieval } : {}),
      systemPrompt: `You are the ${input.agent.role} agent. Use the retrieved project context before acting.`,
      taskContext: [
        {
          title: input.task.name,
          content: [input.task.description, query].filter(Boolean).join("\n"),
          required: true,
          relevance: 1,
        },
      ],
      ...(input.agent.getSnapshot().context.conversationHistory.length > 0
        ? { conversation: input.agent.getSnapshot().context.conversationHistory }
        : {}),
    });

    for (const result of rag.search.results.slice(0, 8)) {
      if (!result.chunk.filePath) {
        continue;
      }

      input.agent.addRelevantFile({
        path: result.chunk.filePath,
        reason: result.chunk.title,
        relevance: result.finalScore,
      });
    }

    input.agent.updateNotes({
      rag_query: query,
      rag_result_count: rag.search.results.length,
      rag_selected_chunk_ids: rag.selectedChunkIds,
      rag_top_sources: rag.search.results.slice(0, 5).map((result) => ({
        title: result.chunk.title,
        ...(result.chunk.filePath ? { filePath: result.chunk.filePath } : {}),
        score: result.finalScore,
        sourceType: result.chunk.sourceType,
      })),
    });
    input.agent.remember("rag_context_snapshot", {
      query,
      selectedChunkIds: rag.selectedChunkIds,
      contextWindow: rag.contextWindow,
    });

    const existingPrompt = readPrompt(input.task);
    const prompt = buildPrompt(existingPrompt, rag.contextWindow.renderedContext);

    return {
      query,
      rag,
      inputPatch: {
        ragQuery: query,
        ragResults: rag.search.results.map((result) => ({
          id: result.chunk.id,
          title: result.chunk.title,
          ...(result.chunk.filePath ? { filePath: result.chunk.filePath } : {}),
          ...(result.chunk.startLine !== undefined ? { startLine: result.chunk.startLine } : {}),
          ...(result.chunk.endLine !== undefined ? { endLine: result.chunk.endLine } : {}),
          sourceType: result.chunk.sourceType,
          chunkLevel: result.chunk.chunkLevel,
          score: result.finalScore,
          vectorScore: result.vectorScore,
          keywordScore: result.keywordScore,
        })),
        retrievedContext: rag.contextWindow.renderedContext,
        ragContextSnapshot: {
          query,
          selectedChunkIds: rag.selectedChunkIds,
          contextWindow: rag.contextWindow,
        },
        ...(prompt ? { prompt } : {}),
      },
    };
  }

  async applyToolMutation(input: RagToolMutationInput): Promise<void> {
    await this.pipeline.applyToolMutation(input);
  }

  async close(): Promise<void> {
    await this.pipeline.close();
  }
}

function deriveQuery(task: ManagedTask): string | undefined {
  const input = asRecord(task.input);
  return readString(input.prompt) ?? readString(input.request) ?? task.description ?? task.name;
}

function readPrompt(task: ManagedTask): string | undefined {
  return readString(asRecord(task.input).prompt);
}

function buildPrompt(
  existingPrompt: string | undefined,
  renderedContext: Record<string, string>
): string | undefined {
  const sections = [
    renderedContext.projectContext
      ? `Project Context:\n${renderedContext.projectContext}`
      : undefined,
    renderedContext.codeContext ? `Code Context:\n${renderedContext.codeContext}` : undefined,
    renderedContext.conversation
      ? `Conversation Context:\n${renderedContext.conversation}`
      : undefined,
  ].filter(Boolean);

  if (!existingPrompt && sections.length === 0) {
    return undefined;
  }

  return [existingPrompt, sections.length > 0 ? sections.join("\n\n") : undefined]
    .filter(Boolean)
    .join("\n\n");
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (structuredClone(value) as Record<string, JsonValue>)
    : {};
}

function readString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
