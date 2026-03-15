import type { JsonValue } from "@ai-office/shared";

export type JsonRecord = Record<string, JsonValue>;

export type TaskFileSnapshot = {
  path: string;
  content?: string;
  proposedContent?: string;
  language?: string;
  purpose?: string;
  changeType?: string;
};

export function asJsonRecord(value: JsonValue | undefined): JsonRecord {
  return isJsonRecord(value) ? structuredClone(value) : {};
}

export function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function readBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

export function readNumber(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readStringArray(record: JsonRecord, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readRecordArray(record: JsonRecord, key: string): JsonRecord[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonRecord).map((entry) => structuredClone(entry));
}

export function readTaskFiles(record: JsonRecord, key = "files"): TaskFileSnapshot[] {
  return readRecordArray(record, key)
    .map((file) => {
      const path = readString(file, "path");
      if (!path) {
        return undefined;
      }

      return {
        path,
        ...(readString(file, "content") ? { content: readString(file, "content") } : {}),
        ...(readString(file, "proposedContent")
          ? { proposedContent: readString(file, "proposedContent") }
          : {}),
        ...(readString(file, "language") ? { language: readString(file, "language") } : {}),
        ...(readString(file, "purpose") ? { purpose: readString(file, "purpose") } : {}),
        ...(readString(file, "changeType") ? { changeType: readString(file, "changeType") } : {}),
      };
    })
    .filter((file): file is TaskFileSnapshot => Boolean(file));
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function estimateTokenUsage(...values: Array<string | JsonValue | undefined>): number {
  const combined = values
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      if (value === undefined) {
        return "";
      }

      return JSON.stringify(value);
    })
    .join(" ")
    .trim();

  if (combined.length === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(combined.split(/\s+/).length * 1.35));
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
