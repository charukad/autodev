import { AgentRole, TaskPriority } from "@prisma/client";
import { RoleAgent } from "./role-agent";
import {
  readString,
  readStringArray,
  readTaskFiles,
  type JsonRecord,
} from "./task-io";
import type { AgentExecutionContext } from "./types";

const testAgentSystemPrompt = [
  "You are the test agent for the AI Office engineering system.",
  "Turn code changes into test scenarios, execution commands, parsed result summaries, and failure analysis.",
  "Report failures clearly and hand back actionable signals when verification does not pass.",
].join(" ");

type TestKind = "unit" | "integration" | "regression" | "smoke";

export type GeneratedTestCase = {
  title: string;
  targetPath?: string;
  kind: TestKind;
  priority: TaskPriority;
  rationale: string;
};

export type TestExecutionPlan = {
  command: string;
  arguments: string[];
  framework: string;
  rationale: string;
};

export type ParsedTestResults = {
  framework: string;
  passed: number;
  failed: number;
  skipped: number;
  failingTests: string[];
};

export type CoverageSummary = {
  lines?: number;
  branches?: number;
  functions?: number;
  statements?: number;
  threshold: number;
  meetsThreshold: boolean;
};

export type FailureAnalysis = {
  category: string;
  summary: string;
  suggestedOwner: AgentRole;
  actionableNextStep: string;
};

export class TestAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return testAgentSystemPrompt;
  }

  generateTestCases(request: string, input: JsonRecord): GeneratedTestCase[] {
    const taskFiles = readTaskFiles(input);
    const targetFiles = readStringArray(input, "targetFiles");
    const relevantFiles = [...new Set([...taskFiles.map((file) => file.path), ...targetFiles])];
    const cases: GeneratedTestCase[] = [];
    const normalizedRequest = request.toLowerCase();

    for (const filePath of relevantFiles) {
      if (filePath.includes(".test.") || filePath.includes(".spec.")) {
        continue;
      }

      cases.push({
        title: `covers ${filePath}`,
        targetPath: filePath,
        kind: normalizedRequest.includes("integration") ? "integration" : "unit",
        priority: normalizedRequest.includes("critical") ? TaskPriority.high : TaskPriority.medium,
        rationale: `The change plan references ${filePath}, so it needs direct verification.`,
      });
    }

    if (normalizedRequest.includes("bug") || normalizedRequest.includes("regression")) {
      cases.push({
        title: "guards against the reported regression",
        kind: "regression",
        priority: TaskPriority.high,
        rationale: "Bugfix work should carry a regression test case.",
      });
    }

    if (cases.length === 0) {
      cases.push({
        title: "runs the relevant smoke coverage",
        kind: "smoke",
        priority: TaskPriority.medium,
        rationale: "Fallback verification keeps the task from shipping untested.",
      });
    }

    return cases;
  }

  buildExecutionPlan(input: JsonRecord): TestExecutionPlan {
    const packageJson = parsePackageJsonFromInput(input);
    const targetFiles = readStringArray(input, "targetFiles");

    if (packageJson?.scripts && typeof packageJson.scripts.test === "string") {
      return {
        command: "npm",
        arguments: ["test", ...(targetFiles.length > 0 ? ["--", ...targetFiles] : [])],
        framework: inferFrameworkFromPackageJson(packageJson),
        rationale: "package.json exposes a test script, so the agent should reuse the project runner.",
      };
    }

    const framework = inferFrameworkFromPackageJson(packageJson);
    if (framework === "vitest") {
      return {
        command: "npx",
        arguments: ["vitest", "run", ...targetFiles],
        framework,
        rationale: "Vitest is present in the project dependencies.",
      };
    }

    if (framework === "jest") {
      return {
        command: "npx",
        arguments: ["jest", ...targetFiles],
        framework,
        rationale: "Jest is present in the project dependencies.",
      };
    }

    if (readString(input, "pythonTestCommand")) {
      return {
        command: "pytest",
        arguments: [],
        framework: "pytest",
        rationale: "Python test execution was requested explicitly.",
      };
    }

    return {
      command: "npm",
      arguments: ["test"],
      framework: "unknown",
      rationale: "Fallback to the common Node test entrypoint when no framework is explicit.",
    };
  }

  parseTestResults(rawOutput: string): ParsedTestResults {
    const framework = inferFrameworkFromOutput(rawOutput);
    const passed = extractCount(rawOutput, [
      /(\d+)\s+passed/i,
      /Tests?\s+(\d+)\s+passed/i,
    ]);
    const failed = extractCount(rawOutput, [
      /(\d+)\s+failed/i,
      /Tests?\s+(\d+)\s+failed/i,
    ]);
    const skipped = extractCount(rawOutput, [
      /(\d+)\s+skipped/i,
      /(\d+)\s+todo/i,
    ]);
    const failingTests = [
      ...rawOutput.matchAll(/^[×x]\s+(.+)$/gim),
      ...rawOutput.matchAll(/^FAIL\s+(.+)$/gim),
      ...rawOutput.matchAll(/^FAILED\s+(.+)$/gim),
    ]
      .map((match) => match[1]?.trim() ?? "")
      .filter(Boolean);

    return {
      framework,
      passed,
      failed,
      skipped,
      failingTests,
    };
  }

  summarizeCoverage(input: JsonRecord): CoverageSummary {
    const threshold = Number(readString(input, "coverageThreshold") ?? "80");
    const coverageText = readString(input, "coverageText");
    const coverageRecord = input.coverage;
    let lines: number | undefined;
    let branches: number | undefined;
    let functions: number | undefined;
    let statements: number | undefined;

    if (coverageText) {
      lines = extractPercentage(coverageText, /lines?\s*[:|]\s*(\d+(?:\.\d+)?)/i);
      branches = extractPercentage(coverageText, /branches?\s*[:|]\s*(\d+(?:\.\d+)?)/i);
      functions = extractPercentage(coverageText, /func(?:tions?)?\s*[:|]\s*(\d+(?:\.\d+)?)/i);
      statements = extractPercentage(coverageText, /stmts?|statements?\s*[:|]\s*(\d+(?:\.\d+)?)/i);
    } else if (coverageRecord && typeof coverageRecord === "object" && coverageRecord !== null && !Array.isArray(coverageRecord)) {
      const record = coverageRecord as Record<string, unknown>;
      lines = toFiniteNumber(record.lines);
      branches = toFiniteNumber(record.branches);
      functions = toFiniteNumber(record.functions);
      statements = toFiniteNumber(record.statements);
    }

    const observedValues = [lines, branches, functions, statements].filter(
      (value): value is number => typeof value === "number"
    );
    const meetsThreshold =
      observedValues.length === 0 ? false : observedValues.every((value) => value >= threshold);

    return {
      ...(lines !== undefined ? { lines } : {}),
      ...(branches !== undefined ? { branches } : {}),
      ...(functions !== undefined ? { functions } : {}),
      ...(statements !== undefined ? { statements } : {}),
      threshold,
      meetsThreshold,
    };
  }

  analyzeFailures(results: ParsedTestResults, rawOutput: string): FailureAnalysis | undefined {
    if (results.failed === 0) {
      return undefined;
    }

    const normalized = rawOutput.toLowerCase();

    if (normalized.includes("cannot find module") || normalized.includes("module not found")) {
      return {
        category: "missing-module",
        summary: "The test run failed because a required module could not be resolved.",
        suggestedOwner: AgentRole.code,
        actionableNextStep: "Check import paths, dependency installation, and file moves.",
      };
    }

    if (normalized.includes("typeerror") || normalized.includes("referenceerror")) {
      return {
        category: "runtime-error",
        summary: "The tests surfaced a runtime exception during execution.",
        suggestedOwner: AgentRole.debug,
        actionableNextStep: "Inspect the failing stack trace and reproduce the code path locally.",
      };
    }

    if (normalized.includes("assertionerror") || normalized.includes("expected")) {
      return {
        category: "assertion-failure",
        summary: "The implementation behavior diverges from the expected assertions.",
        suggestedOwner: AgentRole.code,
        actionableNextStep: "Review the failing expectation and align the implementation or the test fixture.",
      };
    }

    return {
      category: "test-failure",
      summary: "The test suite reported failures that need investigation.",
      suggestedOwner: AgentRole.debug,
      actionableNextStep: "Inspect the failing tests and reproduce them before attempting a fix.",
    };
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const request =
      readString(input, "request") ??
      readString(input, "prompt") ??
      context.task.description ??
      context.task.name;
    const testCases = this.generateTestCases(request, input);
    const executionPlan = this.buildExecutionPlan(input);
    const rawOutput =
      readString(input, "rawOutput") ??
      readString(input, "testOutput") ??
      readString(input, "resultOutput") ??
      "";
    const parsedResults = this.parseTestResults(rawOutput);
    const coverage = this.summarizeCoverage(input);
    const failureAnalysis = this.analyzeFailures(parsedResults, rawOutput);
    const success = parsedResults.failed === 0 && (coverage.meetsThreshold || !rawOutput);

    this.remember("last_test_report", {
      testCases,
      executionPlan,
      parsedResults,
      coverage,
      ...(failureAnalysis ? { failureAnalysis } : {}),
    });
    this.updateNotes({
      test_case_count: testCases.length,
      test_failures: parsedResults.failed,
      test_framework: parsedResults.framework,
    });

    return this.buildExecutionResult({
      success,
      summary: success
        ? `Prepared ${testCases.length} test case(s) and found no blocking verification failures.`
        : `Detected ${parsedResults.failed} failing test(s) during verification.`,
      output: {
        testCases,
        executionPlan,
        parsedResults,
        coverage,
        ...(failureAnalysis ? { failureAnalysis } : {}),
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: success ? "qa-lab" : "debug-bay",
    });
  }
}

function parsePackageJsonFromInput(input: JsonRecord): PackageJsonRecord | undefined {
  const packageJsonFile = readTaskFiles(input).find((file) => file.path === "package.json");
  const contents = packageJsonFile?.content ?? readString(input, "packageJson");

  if (!contents) {
    return undefined;
  }

  try {
    return JSON.parse(contents) as PackageJsonRecord;
  } catch {
    return undefined;
  }
}

type PackageJsonRecord = {
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
};

function inferFrameworkFromPackageJson(packageJson: PackageJsonRecord | undefined): string {
  if (!packageJson) {
    return "unknown";
  }

  const dependencies = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);

  if (dependencies.has("vitest")) {
    return "vitest";
  }

  if (dependencies.has("jest")) {
    return "jest";
  }

  return "unknown";
}

function inferFrameworkFromOutput(rawOutput: string): string {
  const normalized = rawOutput.toLowerCase();

  if (normalized.includes("vitest")) {
    return "vitest";
  }

  if (normalized.includes("jest")) {
    return "jest";
  }

  if (normalized.includes("pytest")) {
    return "pytest";
  }

  return "unknown";
}

function extractCount(rawOutput: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = rawOutput.match(pattern);
    const value = match?.[1] ? Number(match[1]) : Number.NaN;
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function extractPercentage(rawOutput: string, pattern: RegExp): number | undefined {
  const match = rawOutput.match(pattern);
  const value = match?.[1] ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
