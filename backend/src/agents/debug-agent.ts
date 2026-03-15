import { RoleAgent } from "./role-agent";
import { readString, type JsonRecord } from "./task-io";
import type { AgentExecutionContext } from "./types";

const debugAgentSystemPrompt = [
  "You are the debug agent for the AI Office engineering system.",
  "Turn runtime failures into concrete log signals, stack frames, likely root causes, and fix-and-verify plans.",
  "Bias toward the first actionable application frame and the smallest plausible repair.",
].join(" ");

type Confidence = "high" | "medium" | "low";

export type ErrorLogSignal = {
  level: "error" | "warning" | "info";
  message: string;
};

export type StackFrame = {
  filePath: string;
  line: number;
  column?: number;
  functionName?: string;
};

export type RootCauseAnalysis = {
  category: string;
  likelySource?: string;
  explanation: string;
  confidence: Confidence;
};

export type FixSuggestion = {
  title: string;
  description: string;
  targetFiles: string[];
  verificationSteps: string[];
};

export type DebugReport = {
  logSignals: ErrorLogSignal[];
  stackFrames: StackFrame[];
  rootCause: RootCauseAnalysis;
  suggestions: FixSuggestion[];
};

export class DebugAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return debugAgentSystemPrompt;
  }

  analyzeErrorLogs(rawLogs: string): ErrorLogSignal[] {
    const signals: ErrorLogSignal[] = [];

    for (const line of rawLogs
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      const lowered = line.toLowerCase();
      if (
        lowered.includes("error") ||
        lowered.includes("exception") ||
        lowered.includes("failed")
      ) {
        signals.push({
          level: "error",
          message: line,
        });
        continue;
      }

      if (lowered.includes("warn")) {
        signals.push({
          level: "warning",
          message: line,
        });
      }
    }

    return signals;
  }

  parseStackTrace(rawOutput: string): StackFrame[] {
    const frames: StackFrame[] = [];

    for (const line of rawOutput.split(/\r?\n/)) {
      const nodeMatch = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (nodeMatch?.[2] && nodeMatch[3] && nodeMatch[4]) {
        frames.push({
          ...(nodeMatch[1] ? { functionName: nodeMatch[1].trim() } : {}),
          filePath: normalizePath(nodeMatch[2]),
          line: Number(nodeMatch[3]),
          column: Number(nodeMatch[4]),
        });
        continue;
      }

      const pythonMatch = line.match(/^\s*File\s+"(.+?)",\s+line\s+(\d+),\s+in\s+(.+)$/);
      if (pythonMatch?.[1] && pythonMatch[2]) {
        frames.push({
          filePath: normalizePath(pythonMatch[1]),
          line: Number(pythonMatch[2]),
          ...(pythonMatch[3] ? { functionName: pythonMatch[3].trim() } : {}),
        });
      }
    }

    return frames;
  }

  identifyRootCause(
    logSignals: ErrorLogSignal[],
    stackFrames: StackFrame[],
    input: JsonRecord
  ): RootCauseAnalysis {
    const combinedText = [
      ...logSignals.map((signal) => signal.message),
      readString(input, "rawOutput") ?? "",
      readString(input, "error") ?? "",
    ]
      .join("\n")
      .toLowerCase();
    const applicationFrame = stackFrames.find((frame) => !frame.filePath.includes("node_modules"));

    if (combinedText.includes("cannot find module") || combinedText.includes("module not found")) {
      return {
        category: "missing-module",
        ...(applicationFrame ? { likelySource: applicationFrame.filePath } : {}),
        explanation: "A required module import could not be resolved during execution.",
        confidence: applicationFrame ? "high" : "medium",
      };
    }

    if (
      combinedText.includes("cannot read properties of undefined") ||
      combinedText.includes("undefined is not an object") ||
      combinedText.includes("typeerror")
    ) {
      return {
        category: "nullish-access",
        ...(applicationFrame ? { likelySource: applicationFrame.filePath } : {}),
        explanation: "The runtime accessed a value before it was initialized or validated.",
        confidence: applicationFrame ? "high" : "medium",
      };
    }

    if (combinedText.includes("assertionerror") || combinedText.includes("expected")) {
      return {
        category: "incorrect-behavior",
        ...(applicationFrame ? { likelySource: applicationFrame.filePath } : {}),
        explanation: "The implementation behavior diverges from an asserted expectation.",
        confidence: "medium",
      };
    }

    if (combinedText.includes("timeout")) {
      return {
        category: "timeout",
        ...(applicationFrame ? { likelySource: applicationFrame.filePath } : {}),
        explanation: "The failing path likely blocks, retries too long, or never resolves.",
        confidence: "medium",
      };
    }

    return {
      category: "unknown",
      ...(applicationFrame ? { likelySource: applicationFrame.filePath } : {}),
      explanation:
        "The current signals are insufficient for a stronger diagnosis, but the first application frame is the best place to inspect.",
      confidence: applicationFrame ? "medium" : "low",
    };
  }

  generateFixSuggestions(rootCause: RootCauseAnalysis): FixSuggestion[] {
    switch (rootCause.category) {
      case "missing-module":
        return [
          {
            title: "Repair module resolution",
            description:
              "Verify the import path, the file move history, and whether the dependency is installed in the active workspace.",
            targetFiles: rootCause.likelySource ? [rootCause.likelySource] : [],
            verificationSteps: [
              "Run the failing command again after correcting the import or dependency.",
              "Add a regression test for the missing module path.",
            ],
          },
        ];
      case "nullish-access":
        return [
          {
            title: "Guard the failing access path",
            description:
              "Add validation or a default value before the property access that currently crashes.",
            targetFiles: rootCause.likelySource ? [rootCause.likelySource] : [],
            verificationSteps: [
              "Reproduce the failing input locally.",
              "Add a regression test for the nullish path.",
            ],
          },
        ];
      case "incorrect-behavior":
        return [
          {
            title: "Align implementation with the failing assertion",
            description:
              "Compare the expected output with the current implementation and update the logic or fixture that drifted.",
            targetFiles: rootCause.likelySource ? [rootCause.likelySource] : [],
            verificationSteps: [
              "Run the targeted failing test first.",
              "Run the broader suite once the local assertion passes.",
            ],
          },
        ];
      case "timeout":
        return [
          {
            title: "Reduce or eliminate the blocking path",
            description:
              "Inspect loops, retries, network waits, and unresolved promises around the failing frame.",
            targetFiles: rootCause.likelySource ? [rootCause.likelySource] : [],
            verificationSteps: [
              "Re-run with timing logs enabled.",
              "Verify the path completes within the expected timeout budget.",
            ],
          },
        ];
      default:
        return [
          {
            title: "Inspect the first application frame",
            description:
              "Use the earliest non-library stack frame as the starting point for manual debugging.",
            targetFiles: rootCause.likelySource ? [rootCause.likelySource] : [],
            verificationSteps: [
              "Reproduce the failure with verbose logging enabled.",
              "Capture a smaller failing test case before editing code.",
            ],
          },
        ];
    }
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const rawOutput =
      readString(input, "rawOutput") ??
      readString(input, "error") ??
      context.task.description ??
      context.task.name;
    const logSignals = this.analyzeErrorLogs(rawOutput);
    const stackFrames = this.parseStackTrace(rawOutput);
    const rootCause = this.identifyRootCause(logSignals, stackFrames, input);
    const suggestions = this.generateFixSuggestions(rootCause);
    const report: DebugReport = {
      logSignals,
      stackFrames,
      rootCause,
      suggestions,
    };

    this.remember("last_debug_report", report);
    this.updateNotes({
      debug_root_cause: rootCause.category,
      debug_confidence: rootCause.confidence,
      debug_candidate_files: suggestions.flatMap((suggestion) => suggestion.targetFiles),
    });

    return this.buildExecutionResult({
      success: rootCause.confidence !== "low" || stackFrames.length > 0,
      summary: `Diagnosed ${rootCause.category} from ${stackFrames.length} stack frame(s).`,
      output: {
        report,
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: "debug-bay",
    });
  }
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
