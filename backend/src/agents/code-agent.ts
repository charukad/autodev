import path from "node:path";
import { RoleAgent } from "./role-agent";
import {
  readString,
  readStringArray,
  readTaskFiles,
  toSlug,
  uniqueStrings,
  type JsonRecord,
  type TaskFileSnapshot,
} from "./task-io";
import type { AgentExecutionContext } from "./types";

const codeAgentSystemPrompt = [
  "You are the code agent for the AI Office engineering system.",
  "Turn scoped tasks into concrete file changes, patch previews, formatting steps, and a safe execution order.",
  "Prefer small, verifiable edits with clear follow-up validation.",
].join(" ");

type FileActionType = "create" | "modify" | "delete";

export type CodeFileAction = {
  path: string;
  action: FileActionType;
  summary: string;
  reason: string;
  dependsOn: string[];
};

export type CodeArtifact = {
  path: string;
  language: string;
  content: string;
};

export type PatchPreview = {
  path: string;
  hasChanges: boolean;
  diff: string;
};

export type FormattingPlan = {
  commands: string[];
  reasoning: string[];
};

export type MultiFileChangePlan = {
  orderedFiles: string[];
  parallelizableFiles: string[];
  validationSteps: string[];
};

export type CodeExecutionPlan = {
  actions: CodeFileAction[];
  artifacts: CodeArtifact[];
  patches: PatchPreview[];
  formatting: FormattingPlan;
  coordination: MultiFileChangePlan;
};

export class CodeAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return codeAgentSystemPrompt;
  }

  generateImplementationActions(request: string, input: JsonRecord): CodeFileAction[] {
    const taskFiles = readTaskFiles(input);
    const targetFiles = uniqueStrings([
      ...taskFiles.map((file) => file.path),
      ...readStringArray(input, "targetFiles"),
      ...inferFilesFromRequest(request),
    ]);

    const requestedAction = inferRequestedAction(request);

    if (targetFiles.length === 0) {
      const inferredPath = inferDefaultTargetFile(request);
      targetFiles.push(inferredPath);
    }

    return targetFiles.map((targetFile) => {
      const normalizedPath = normalizePath(targetFile);
      const fileRecord = taskFiles.find((file) => normalizePath(file.path) === normalizedPath);
      const action = resolveAction(requestedAction, fileRecord);

      return {
        path: normalizedPath,
        action,
        summary: buildActionSummary(request, normalizedPath, action),
        reason: buildActionReason(normalizedPath, action),
        dependsOn: normalizedPath.includes(".test.") || normalizedPath.includes(".spec.")
          ? targetFiles
              .map(normalizePath)
              .filter((filePath) => filePath !== normalizedPath && !isTestFile(filePath))
          : [],
      };
    });
  }

  generateCodeArtifacts(request: string, actions: CodeFileAction[]): CodeArtifact[] {
    return actions
      .filter((action) => action.action !== "delete")
      .map((action) => {
        const language = inferLanguageFromPath(action.path);
        return {
          path: action.path,
          language,
          content: generateArtifactContent(request, action.path, language),
        };
      });
  }

  generatePatchPreview(filePath: string, before: string, after: string): PatchPreview {
    if (before === after) {
      return {
        path: normalizePath(filePath),
        hasChanges: false,
        diff: "",
      };
    }

    const beforeLines = before.split(/\r?\n/);
    const afterLines = after.split(/\r?\n/);
    let prefix = 0;
    while (
      prefix < beforeLines.length &&
      prefix < afterLines.length &&
      beforeLines[prefix] === afterLines[prefix]
    ) {
      prefix += 1;
    }

    let suffix = 0;
    while (
      suffix < beforeLines.length - prefix &&
      suffix < afterLines.length - prefix &&
      beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
    ) {
      suffix += 1;
    }

    const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
    const added = afterLines.slice(prefix, afterLines.length - suffix);

    const diffLines = [
      `--- a/${normalizePath(filePath)}`,
      `+++ b/${normalizePath(filePath)}`,
      `@@ -${prefix + 1},${Math.max(removed.length, 1)} +${prefix + 1},${Math.max(added.length, 1)} @@`,
      ...removed.map((line) => `-${line}`),
      ...added.map((line) => `+${line}`),
    ];

    return {
      path: normalizePath(filePath),
      hasChanges: true,
      diff: diffLines.join("\n"),
    };
  }

  buildFormattingPlan(input: JsonRecord, actions: CodeFileAction[]): FormattingPlan {
    const packageJson = parsePackageJsonFromInput(input);
    const changedFiles = actions.map((action) => action.path);
    const commands: string[] = [];
    const reasoning: string[] = [];

    if (packageJson?.scripts && typeof packageJson.scripts.format === "string") {
      commands.push("npm run format");
      reasoning.push("package.json exposes a dedicated format script.");
    } else if (changedFiles.some((filePath) => isWebFile(filePath))) {
      commands.push(`npx prettier --write ${changedFiles.join(" ")}`);
      reasoning.push("Changed files use web stack extensions that Prettier handles well.");
    }

    if (changedFiles.some((filePath) => filePath.endsWith(".py"))) {
      commands.push(`ruff format ${changedFiles.filter((filePath) => filePath.endsWith(".py")).join(" ")}`);
      reasoning.push("Python files need formatter coverage.");
    }

    if (changedFiles.some((filePath) => filePath.endsWith(".go"))) {
      commands.push(`gofmt -w ${changedFiles.filter((filePath) => filePath.endsWith(".go")).join(" ")}`);
      reasoning.push("Go files should be normalized with gofmt.");
    }

    return {
      commands,
      reasoning,
    };
  }

  coordinateMultiFileChanges(actions: CodeFileAction[]): MultiFileChangePlan {
    const orderedFiles = [...actions]
      .sort((left, right) => rankFileForChange(left.path) - rankFileForChange(right.path))
      .map((action) => action.path);

    return {
      orderedFiles,
      parallelizableFiles: actions
        .filter((action) => action.dependsOn.length === 0 && !isTestFile(action.path))
        .map((action) => action.path),
      validationSteps: [
        "Apply shared contracts and configuration changes first.",
        "Implement source updates before generating or updating tests.",
        "Run formatting and the relevant test suite after code changes land.",
      ],
    };
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const request =
      readString(input, "request") ??
      readString(input, "prompt") ??
      context.task.description ??
      context.task.name;
    const actions = this.generateImplementationActions(request, input);
    const artifacts = this.generateCodeArtifacts(request, actions);
    const taskFiles = readTaskFiles(input);
    const patches = actions.map((action) => {
      const fileRecord = taskFiles.find((file) => normalizePath(file.path) === action.path);
      const artifact = artifacts.find((candidate) => candidate.path === action.path);
      const before = fileRecord?.content ?? "";
      const after = fileRecord?.proposedContent ?? artifact?.content ?? before;

      return this.generatePatchPreview(action.path, before, after);
    });
    const formatting = this.buildFormattingPlan(input, actions);
    const coordination = this.coordinateMultiFileChanges(actions);
    const executionPlan: CodeExecutionPlan = {
      actions,
      artifacts,
      patches,
      formatting,
      coordination,
    };

    this.remember("last_code_execution_plan", executionPlan);
    this.updateNotes({
      code_plan_summary: `${actions.length} file action(s) prepared for ${context.task.name}.`,
      code_changed_files: actions.map((action) => action.path),
    });

    return this.buildExecutionResult({
      summary: `Prepared ${actions.length} code change action(s) for ${context.task.name}.`,
      output: {
        executionPlan,
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: "dev-pod",
    });
  }
}

function inferRequestedAction(request: string): FileActionType {
  const normalized = request.toLowerCase();

  if (normalized.includes("delete") || normalized.includes("remove")) {
    return "delete";
  }

  if (normalized.includes("create") || normalized.includes("add new")) {
    return "create";
  }

  return "modify";
}

function resolveAction(requestedAction: FileActionType, fileRecord: TaskFileSnapshot | undefined): FileActionType {
  if (requestedAction === "delete") {
    return "delete";
  }

  if (!fileRecord?.content) {
    return "create";
  }

  return "modify";
}

function buildActionSummary(request: string, filePath: string, action: FileActionType): string {
  const base = request.replace(/\s+/g, " ").trim();
  return `${action.toUpperCase()} ${filePath}: ${base}`;
}

function buildActionReason(filePath: string, action: FileActionType): string {
  if (action === "delete") {
    return `The request implies removing or retiring ${filePath}.`;
  }

  if (action === "create") {
    return `The plan needs a new artifact at ${filePath}.`;
  }

  return `The request targets existing logic in ${filePath}.`;
}

function inferFilesFromRequest(request: string): string[] {
  return [...request.matchAll(/([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/g)]
    .map((match) => match[1] ?? "")
    .filter(Boolean);
}

function inferDefaultTargetFile(request: string): string {
  const componentMatch = request.match(/component\s+([A-Z][A-Za-z0-9]+)/i);
  if (componentMatch?.[1]) {
    return `src/${componentMatch[1]}.tsx`;
  }

  const classMatch = request.match(/class\s+([A-Z][A-Za-z0-9]+)/i);
  if (classMatch?.[1]) {
    return `src/${classMatch[1]}.ts`;
  }

  const functionMatch = request.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/i);
  if (functionMatch?.[1]) {
    return `src/${toSlug(functionMatch[1])}.ts`;
  }

  return "src/generated-change.ts";
}

function inferLanguageFromPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".tsx":
    case ".jsx":
      return "react";
    case ".ts":
      return "typescript";
    case ".js":
      return "javascript";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".md":
      return "markdown";
    default:
      return "text";
  }
}

function generateArtifactContent(request: string, filePath: string, language: string): string {
  const componentMatch = request.match(/component\s+([A-Z][A-Za-z0-9]+)/i);
  const classMatch = request.match(/class\s+([A-Z][A-Za-z0-9]+)/i);
  const functionMatch = request.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/i);

  if (language === "react" && componentMatch?.[1]) {
    return [
      `export function ${componentMatch[1]}() {`,
      `  return <div>${componentMatch[1]}</div>;`,
      "}",
      "",
    ].join("\n");
  }

  if ((language === "typescript" || language === "javascript") && functionMatch?.[1]) {
    return [
      `export function ${functionMatch[1]}() {`,
      `  throw new Error("${functionMatch[1]} is not implemented yet.");`,
      "}",
      "",
    ].join("\n");
  }

  if ((language === "typescript" || language === "javascript") && classMatch?.[1]) {
    return [
      `export class ${classMatch[1]} {`,
      "  constructor() {}",
      "}",
      "",
    ].join("\n");
  }

  if (language === "markdown") {
    return `# ${path.basename(filePath)}\n\n- ${request.trim()}\n`;
  }

  return [`// TODO: ${request.trim()}`, ""].join("\n");
}

function parsePackageJsonFromInput(input: JsonRecord): PackageJsonRecord | undefined {
  const taskFiles = readTaskFiles(input);
  const packageJsonFromFiles = taskFiles.find((file) => normalizePath(file.path) === "package.json");
  const packageJsonContents = packageJsonFromFiles?.content ?? readString(input, "packageJson");

  if (!packageJsonContents) {
    return undefined;
  }

  try {
    return JSON.parse(packageJsonContents) as PackageJsonRecord;
  } catch {
    return undefined;
  }
}

type PackageJsonRecord = {
  scripts?: Record<string, unknown>;
};

function rankFileForChange(filePath: string): number {
  if (filePath.includes("config") || filePath.endsWith("package.json") || filePath.endsWith("tsconfig.json")) {
    return 1;
  }

  if (filePath.includes("types") || filePath.includes("schema")) {
    return 2;
  }

  if (isTestFile(filePath)) {
    return 4;
  }

  return 3;
}

function isTestFile(filePath: string): boolean {
  return filePath.includes(".test.") || filePath.includes(".spec.") || filePath.includes("/tests/");
}

function isWebFile(filePath: string): boolean {
  return [".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".yml", ".yaml"].includes(
    path.extname(filePath).toLowerCase()
  );
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}
