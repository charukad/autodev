import { promises as fs } from "node:fs";
import path from "node:path";
import type { RagIndexedChunk } from "./types";
import { cosineSimilarity } from "./embedding-engine";

export type VectorQueryOptions = {
  limit: number;
  sourceTypes?: string[];
  fileTypes?: string[];
  directoryScope?: string[];
};

export type VectorQueryHit = {
  chunk: RagIndexedChunk;
  similarity: number;
};

export interface RagVectorStore {
  upsert(namespace: string, chunks: RagIndexedChunk[]): Promise<void>;
  list(namespace: string): Promise<RagIndexedChunk[]>;
  query(
    namespace: string,
    embedding: number[],
    options: VectorQueryOptions
  ): Promise<VectorQueryHit[]>;
  remove(namespace: string, predicate: (chunk: RagIndexedChunk) => boolean): Promise<void>;
  clearNamespace(namespace: string): Promise<void>;
  count(namespace: string): Promise<number>;
  close(): Promise<void>;
}

export class InMemoryRagVectorStore implements RagVectorStore {
  private readonly namespaces = new Map<string, Map<string, RagIndexedChunk>>();

  async upsert(namespace: string, chunks: RagIndexedChunk[]): Promise<void> {
    const records = this.ensureNamespace(namespace);
    for (const chunk of chunks) {
      records.set(chunk.id, structuredClone(chunk));
    }
  }

  async list(namespace: string): Promise<RagIndexedChunk[]> {
    return [...(this.namespaces.get(namespace)?.values() ?? [])].map((chunk) =>
      structuredClone(chunk)
    );
  }

  async query(
    namespace: string,
    embedding: number[],
    options: VectorQueryOptions
  ): Promise<VectorQueryHit[]> {
    const records = await this.list(namespace);
    return rankVectorHits(records, embedding, options);
  }

  async remove(namespace: string, predicate: (chunk: RagIndexedChunk) => boolean): Promise<void> {
    const records = this.namespaces.get(namespace);
    if (!records) {
      return;
    }

    for (const [id, chunk] of records) {
      if (predicate(chunk)) {
        records.delete(id);
      }
    }
  }

  async clearNamespace(namespace: string): Promise<void> {
    this.namespaces.delete(namespace);
  }

  async count(namespace: string): Promise<number> {
    return this.namespaces.get(namespace)?.size ?? 0;
  }

  async close(): Promise<void> {}

  private ensureNamespace(namespace: string): Map<string, RagIndexedChunk> {
    const existing = this.namespaces.get(namespace);
    if (existing) {
      return existing;
    }

    const created = new Map<string, RagIndexedChunk>();
    this.namespaces.set(namespace, created);
    return created;
  }
}

export class JsonFileRagVectorStore implements RagVectorStore {
  constructor(private readonly baseDirectory: string) {}

  async upsert(namespace: string, chunks: RagIndexedChunk[]): Promise<void> {
    const existing = await this.loadNamespace(namespace);
    const records = new Map(existing.map((chunk) => [chunk.id, chunk]));
    for (const chunk of chunks) {
      records.set(chunk.id, structuredClone(chunk));
    }
    await this.saveNamespace(namespace, [...records.values()]);
  }

  async list(namespace: string): Promise<RagIndexedChunk[]> {
    return this.loadNamespace(namespace);
  }

  async query(
    namespace: string,
    embedding: number[],
    options: VectorQueryOptions
  ): Promise<VectorQueryHit[]> {
    return rankVectorHits(await this.list(namespace), embedding, options);
  }

  async remove(namespace: string, predicate: (chunk: RagIndexedChunk) => boolean): Promise<void> {
    const records = await this.loadNamespace(namespace);
    await this.saveNamespace(
      namespace,
      records.filter((chunk) => !predicate(chunk))
    );
  }

  async clearNamespace(namespace: string): Promise<void> {
    await fs.rm(this.namespacePath(namespace), { force: true });
  }

  async count(namespace: string): Promise<number> {
    return (await this.loadNamespace(namespace)).length;
  }

  async close(): Promise<void> {}

  private async loadNamespace(namespace: string): Promise<RagIndexedChunk[]> {
    const filePath = this.namespacePath(namespace);
    const raw = await fs.readFile(filePath, "utf8").catch(() => undefined);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RagIndexedChunk[];
    return parsed.map((chunk) => structuredClone(chunk));
  }

  private async saveNamespace(namespace: string, chunks: RagIndexedChunk[]): Promise<void> {
    await fs.mkdir(this.baseDirectory, { recursive: true });
    await fs.writeFile(this.namespacePath(namespace), JSON.stringify(chunks, null, 2), "utf8");
  }

  private namespacePath(namespace: string): string {
    const safeName = namespace.replace(/[^A-Za-z0-9._-]+/g, "_");
    return path.join(this.baseDirectory, `${safeName}.json`);
  }
}

function rankVectorHits(
  records: RagIndexedChunk[],
  embedding: number[],
  options: VectorQueryOptions
): VectorQueryHit[] {
  return records
    .filter((chunk) => matchesFilters(chunk, options))
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(embedding, chunk.embedding),
    }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, options.limit);
}

function matchesFilters(chunk: RagIndexedChunk, options: VectorQueryOptions): boolean {
  if (
    options.sourceTypes &&
    options.sourceTypes.length > 0 &&
    !options.sourceTypes.includes(chunk.sourceType)
  ) {
    return false;
  }

  if (options.fileTypes && options.fileTypes.length > 0) {
    if (!chunk.filePath) {
      return false;
    }

    if (
      !options.fileTypes.some((extension) =>
        chunk.filePath?.endsWith(extension.startsWith(".") ? extension : `.${extension}`)
      )
    ) {
      return false;
    }
  }

  if (options.directoryScope && options.directoryScope.length > 0) {
    if (!chunk.filePath) {
      return false;
    }

    if (!options.directoryScope.some((prefix) => chunk.filePath?.startsWith(prefix))) {
      return false;
    }
  }

  return true;
}
