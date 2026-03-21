export interface EmbeddingEngine {
  readonly name: string;
  readonly dimension: number;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class LocalHashEmbeddingEngine implements EmbeddingEngine {
  readonly name = "local-hash-embedding";
  readonly dimension: number;

  constructor(dimension = 256) {
    this.dimension = dimension;
  }

  async embedText(text: string): Promise<number[]> {
    return embedWithHashing(text, this.dimension);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedText(text)));
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function tokenizeForEmbedding(text: string): string[] {
  const normalized = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9_./-]+/g, " ")
    .toLowerCase();
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  const tokenSet = new Set<string>();
  for (const token of tokens) {
    tokenSet.add(token);
    for (const fragment of token.split(/[./_-]/).filter((part) => part.length > 1)) {
      tokenSet.add(fragment);
    }
  }

  return [...tokenSet];
}

function embedWithHashing(text: string, dimension: number): number[] {
  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = tokenizeForEmbedding(text);

  for (const token of tokens) {
    const index = hashToken(token, dimension);
    vector[index] = (vector[index] ?? 0) + 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function hashToken(value: string, modulus: number): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash) % modulus;
}
