import path from "node:path";
import { RiskLevel } from "@prisma/client";
import { RoleAgent } from "./role-agent";
import {
  readString,
  readStringArray,
  readTaskFiles,
  type JsonRecord,
  type TaskFileSnapshot,
} from "./task-io";
import type { AgentExecutionContext } from "./types";

const securityAgentSystemPrompt = [
  "You are the security agent for the AI Office engineering system.",
  "Review commands, file access, code changes, secrets, and dependency declarations for avoidable risk.",
  "Flag dangerous actions early and explain the concrete reason behind every finding.",
].join(" ");

export type CommandRiskAssessment = {
  command: string;
  risk: RiskLevel;
  reasons: string[];
  requiresApproval: boolean;
};

export type FileAccessAssessment = {
  path: string;
  risk: RiskLevel;
  reason: string;
};

export type SecurityFinding = {
  type: "code" | "secret" | "dependency";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  recommendation: string;
  path?: string;
  evidence?: string;
};

export type DependencyRisk = {
  name: string;
  version: string;
  risk: RiskLevel;
  reason: string;
  sourcePath: string;
};

export type SecurityReport = {
  commandAssessments: CommandRiskAssessment[];
  fileAccessAssessments: FileAccessAssessment[];
  codeFindings: SecurityFinding[];
  secretFindings: SecurityFinding[];
  dependencyRisks: DependencyRisk[];
};

const dangerousCommandPatterns = [
  { pattern: /\brm\s+-rf\s+\//, reason: "Deletes the filesystem root recursively." },
  { pattern: /\bmkfs\b/, reason: "Formats a filesystem device." },
  { pattern: /\bdd\s+if=/, reason: "Can overwrite raw devices or large binary targets." },
  { pattern: /\bcurl\b.+\|\s*(sh|bash)\b/, reason: "Pipes remote code directly into a shell." },
  { pattern: /\bchmod\s+-R\s+777\b/, reason: "Applies dangerously broad filesystem permissions." },
];

const moderateCommandPatterns = [
  { pattern: /\bnpm\s+publish\b/, reason: "Publishes packages to a registry." },
  { pattern: /\bgit\s+push\b/, reason: "Pushes code to a remote repository." },
  { pattern: /\bdocker\s+run\b/, reason: "Runs a container with host-dependent effects." },
  { pattern: /\bterraform\s+apply\b/, reason: "Applies infrastructure changes." },
];

export class SecurityAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return securityAgentSystemPrompt;
  }

  evaluateCommandRisk(command: string): CommandRiskAssessment {
    for (const { pattern, reason } of dangerousCommandPatterns) {
      if (pattern.test(command)) {
        return {
          command,
          risk: RiskLevel.dangerous,
          reasons: [reason],
          requiresApproval: true,
        };
      }
    }

    for (const { pattern, reason } of moderateCommandPatterns) {
      if (pattern.test(command)) {
        return {
          command,
          risk: RiskLevel.moderate,
          reasons: [reason],
          requiresApproval: true,
        };
      }
    }

    return {
      command,
      risk: RiskLevel.safe,
      reasons: ["No destructive or privileged shell pattern was detected."],
      requiresApproval: false,
    };
  }

  assessFileAccess(paths: string[], workspaceRoot?: string): FileAccessAssessment[] {
    const normalizedWorkspace = workspaceRoot ? path.resolve(workspaceRoot) : undefined;

    return paths.map((filePath) => {
      const resolvedPath = normalizedWorkspace
        ? path.resolve(normalizedWorkspace, filePath)
        : path.resolve(filePath);
      const normalizedPath = normalizePath(filePath);

      if (normalizedWorkspace && !resolvedPath.startsWith(normalizedWorkspace)) {
        return {
          path: normalizedPath,
          risk: RiskLevel.dangerous,
          reason: "The path resolves outside the workspace root.",
        };
      }

      if (
        normalizedPath.includes(".ssh") ||
        normalizedPath.endsWith(".pem") ||
        normalizedPath.endsWith(".key") ||
        normalizedPath.includes(".env")
      ) {
        return {
          path: normalizedPath,
          risk: RiskLevel.moderate,
          reason: "The path appears to contain credentials or environment secrets.",
        };
      }

      return {
        path: normalizedPath,
        risk: RiskLevel.safe,
        reason: "The path stays inside normal workspace boundaries.",
      };
    });
  }

  scanCodeForVulnerabilities(files: TaskFileSnapshot[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      const content = file.proposedContent ?? file.content ?? "";
      const normalizedPath = normalizePath(file.path);

      for (const [pattern, message, severity, recommendation] of vulnerabilityRules) {
        const match = content.match(pattern);
        if (!match) {
          continue;
        }

        findings.push({
          type: "code",
          severity,
          message,
          recommendation,
          path: normalizedPath,
          evidence: match[0],
        });
      }
    }

    return findings;
  }

  detectSecrets(files: TaskFileSnapshot[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      const content = file.proposedContent ?? file.content ?? "";
      const normalizedPath = normalizePath(file.path);

      for (const [pattern, message, severity, recommendation] of secretRules) {
        const match = content.match(pattern);
        if (!match) {
          continue;
        }

        findings.push({
          type: "secret",
          severity,
          message,
          recommendation,
          path: normalizedPath,
          evidence: match[0].slice(0, 24),
        });
      }
    }

    return findings;
  }

  checkDependencyRisks(input: JsonRecord): DependencyRisk[] {
    const risks: DependencyRisk[] = [];
    const packageJson = parsePackageJsonFromInput(input);

    for (const [sourcePath, dependencies] of [
      ["package.json", packageJson?.dependencies],
      ["package.json", packageJson?.devDependencies],
    ] as const) {
      for (const [name, rawVersion] of Object.entries(dependencies ?? {})) {
        if (typeof rawVersion !== "string") {
          continue;
        }

        if (rawVersion === "*" || rawVersion === "latest") {
          risks.push({
            name,
            version: rawVersion,
            risk: RiskLevel.moderate,
            reason: "The dependency version is unpinned and can drift unexpectedly.",
            sourcePath,
          });
        }

        if (/^(git\+|https?:\/\/|github:)/i.test(rawVersion)) {
          risks.push({
            name,
            version: rawVersion,
            risk: RiskLevel.moderate,
            reason: "The dependency is fetched from a mutable remote source.",
            sourcePath,
          });
        }

        if (knownRiskyPackages.has(name)) {
          risks.push({
            name,
            version: rawVersion,
            risk: RiskLevel.dangerous,
            reason: "The dependency name is on the local risky-package watch list.",
            sourcePath,
          });
        }
      }
    }

    return risks;
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const commands = readStringArray(input, "commands");
    const filePaths = readStringArray(input, "paths");
    const workspaceRoot = readString(input, "workspaceRoot");
    const taskFiles = readTaskFiles(input);
    const commandAssessments = commands.map((command) => this.evaluateCommandRisk(command));
    const fileAccessAssessments = this.assessFileAccess(filePaths, workspaceRoot);
    const codeFindings = this.scanCodeForVulnerabilities(taskFiles);
    const secretFindings = this.detectSecrets(taskFiles);
    const dependencyRisks = this.checkDependencyRisks(input);
    const report: SecurityReport = {
      commandAssessments,
      fileAccessAssessments,
      codeFindings,
      secretFindings,
      dependencyRisks,
    };
    const hasBlockingRisk =
      commandAssessments.some((assessment) => assessment.risk === RiskLevel.dangerous) ||
      fileAccessAssessments.some((assessment) => assessment.risk === RiskLevel.dangerous) ||
      codeFindings.some((finding) => finding.severity === "high" || finding.severity === "critical") ||
      secretFindings.length > 0 ||
      dependencyRisks.some((risk) => risk.risk === RiskLevel.dangerous);

    this.remember("last_security_report", report);
    this.updateNotes({
      security_blocking: hasBlockingRisk,
      security_findings: codeFindings.length + secretFindings.length + dependencyRisks.length,
      security_commands_reviewed: commandAssessments.length,
    });

    return this.buildExecutionResult({
      success: !hasBlockingRisk,
      summary: hasBlockingRisk
        ? "Security review found blocking risks that need remediation."
        : "Security review found no blocking risks.",
      output: {
        report,
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: "security-desk",
    });
  }
}

const vulnerabilityRules: Array<[RegExp, string, SecurityFinding["severity"], string]> = [
  [
    /\beval\s*\(/,
    "Use of eval introduces arbitrary code execution risk.",
    "critical",
    "Replace eval with a safe parser or an explicit interpreter.",
  ],
  [
    /\bnew Function\s*\(/,
    "Dynamic function construction introduces arbitrary code execution risk.",
    "critical",
    "Remove dynamic code construction and use static functions instead.",
  ],
  [
    /\bchild_process\.(?:exec|execSync)\s*\(/,
    "Shell execution in application code expands command-injection exposure.",
    "high",
    "Prefer spawn/execFile with validated arguments or avoid shell execution entirely.",
  ],
  [
    /\bdangerouslySetInnerHTML\b/,
    "Direct HTML injection needs strict sanitization review.",
    "high",
    "Sanitize the HTML source or use safer rendering primitives.",
  ],
];

const secretRules: Array<[RegExp, string, SecurityFinding["severity"], string]> = [
  [
    /sk-[A-Za-z0-9]{20,}/,
    "Possible OpenAI API key detected in source.",
    "critical",
    "Move the secret to environment configuration and rotate the exposed key.",
  ],
  [
    /AKIA[0-9A-Z]{16}/,
    "Possible AWS access key detected in source.",
    "critical",
    "Remove the credential from source control and rotate it immediately.",
  ],
  [
    /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{12,}["']/i,
    "Possible hard-coded secret detected in source.",
    "high",
    "Replace the inline secret with secure environment or secret-manager access.",
  ],
];

const knownRiskyPackages = new Set(["event-stream", "node-serialize"]);

function parsePackageJsonFromInput(input: JsonRecord): PackageJsonRecord | undefined {
  const packageJsonFile = readTaskFiles(input).find((file) => normalizePath(file.path) === "package.json");
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
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
};

function normalizePath(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}
