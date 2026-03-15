import { promises as fs } from "node:fs";
import path from "node:path";
import { RoleAgent } from "./role-agent";
import {
  readNumber,
  readString,
  readStringArray,
  readTaskFiles,
  uniqueStrings,
  type JsonRecord,
  type TaskFileSnapshot,
} from "./task-io";
import type { AgentExecutionContext } from "./types";

const repoScannerSystemPrompt = [
  "You are the repository scanner agent for the AI Office engineering system.",
  "Profile the repository structure, detect frameworks and languages, identify entry points, and summarize dependencies and configuration files.",
  "Prefer concrete filesystem evidence over assumptions.",
].join(" ");

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
  ".venv",
  "venv",
]);

type TechnologyKind = "framework" | "language" | "tooling";
type Confidence = "high" | "medium";

export type DetectedTechnology = {
  kind: TechnologyKind;
  name: string;
  evidence: string;
  confidence: Confidence;
};

export type EntryPointCandidate = {
  path: string;
  reason: string;
  confidence: Confidence;
};

export type ConfigFileCandidate = {
  path: string;
  category: string;
};

export type DependencyRecord = {
  ecosystem: string;
  name: string;
  version: string;
  sourcePath: string;
  dependencyType?: string;
};

export type RepositoryStructure = {
  rootPath?: string;
  directories: string[];
  files: string[];
  sourceRoots: string[];
  manifestFiles: string[];
};

export type RepositoryScanReport = {
  structure: RepositoryStructure;
  technologies: DetectedTechnology[];
  entryPoints: EntryPointCandidate[];
  configFiles: ConfigFileCandidate[];
  dependencies: DependencyRecord[];
};

type RepositorySnapshot = {
  rootPath?: string;
  directories: string[];
  files: string[];
  manifests: Record<string, string>;
};

export class RepoScannerAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return repoScannerSystemPrompt;
  }

  async collectRepositorySnapshot(input: JsonRecord): Promise<RepositorySnapshot> {
    const workspacePath =
      readString(input, "workspacePath") ??
      readString(input, "rootPath") ??
      readString(input, "repositoryPath");
    const maxFiles = readNumber(input, "maxFiles") ?? 500;

    if (workspacePath) {
      return scanWorkspace(workspacePath, maxFiles);
    }

    const taskFiles = readTaskFiles(input);
    const filePaths = uniqueStrings([
      ...taskFiles.map((file) => normalizePath(file.path)),
      ...readStringArray(input, "filePaths").map(normalizePath),
    ]);
    const manifests = extractManifestContents(taskFiles);

    return {
      directories: inferDirectories(filePaths),
      files: filePaths,
      manifests,
    };
  }

  analyzeStructure(snapshot: RepositorySnapshot): RepositoryStructure {
    const sourceRoots = uniqueStrings(
      snapshot.files
        .map((file) => file.split("/")[0] ?? "")
        .filter((segment) =>
          ["apps", "backend", "cli", "frontend", "lib", "packages", "services", "shared", "src"]
            .includes(segment)
        )
    );

    return {
      ...(snapshot.rootPath ? { rootPath: snapshot.rootPath } : {}),
      directories: [...snapshot.directories].sort(),
      files: [...snapshot.files].sort(),
      sourceRoots,
      manifestFiles: Object.keys(snapshot.manifests).sort(),
    };
  }

  detectTechnologies(snapshot: RepositorySnapshot): DetectedTechnology[] {
    const technologies = new Map<string, DetectedTechnology>();
    const addTechnology = (technology: DetectedTechnology) => {
      technologies.set(`${technology.kind}:${technology.name}`, technology);
    };

    if (snapshot.files.some((file) => file.endsWith(".ts") || file.endsWith(".tsx")) || snapshot.files.includes("tsconfig.json")) {
      addTechnology({
        kind: "language",
        name: "TypeScript",
        evidence: "Detected .ts/.tsx sources or tsconfig.json",
        confidence: "high",
      });
    }

    if (snapshot.files.some((file) => file.endsWith(".js") || file.endsWith(".jsx")) || snapshot.files.includes("package.json")) {
      addTechnology({
        kind: "language",
        name: "JavaScript",
        evidence: "Detected .js/.jsx sources or package.json",
        confidence: "medium",
      });
    }

    if (snapshot.files.some((file) => file.endsWith(".py")) || snapshot.files.includes("requirements.txt") || snapshot.files.includes("pyproject.toml")) {
      addTechnology({
        kind: "language",
        name: "Python",
        evidence: "Detected Python source files or Python manifest files",
        confidence: "high",
      });
    }

    if (snapshot.files.some((file) => file.endsWith(".go")) || snapshot.files.includes("go.mod")) {
      addTechnology({
        kind: "language",
        name: "Go",
        evidence: "Detected Go sources or go.mod",
        confidence: "high",
      });
    }

    if (snapshot.files.some((file) => file.endsWith(".rs")) || snapshot.files.includes("Cargo.toml")) {
      addTechnology({
        kind: "language",
        name: "Rust",
        evidence: "Detected Rust sources or Cargo.toml",
        confidence: "high",
      });
    }

    const packageJson = parsePackageJson(snapshot.manifests["package.json"]);
    const dependencyNames = packageJson ? getPackageDependencyNames(packageJson) : [];

    addPackageTechnology(technologies, dependencyNames, "react", "framework", "React");
    addPackageTechnology(technologies, dependencyNames, "next", "framework", "Next.js");
    addPackageTechnology(technologies, dependencyNames, "fastify", "framework", "Fastify");
    addPackageTechnology(technologies, dependencyNames, "express", "framework", "Express");
    addPackageTechnology(technologies, dependencyNames, "vite", "tooling", "Vite");
    addPackageTechnology(technologies, dependencyNames, "vitest", "tooling", "Vitest");
    addPackageTechnology(technologies, dependencyNames, "jest", "tooling", "Jest");
    addPackageTechnology(technologies, dependencyNames, "eslint", "tooling", "ESLint");
    addPackageTechnology(technologies, dependencyNames, "prettier", "tooling", "Prettier");

    if (snapshot.files.some((file) => file === "Dockerfile" || file.startsWith("docker-compose"))) {
      addTechnology({
        kind: "tooling",
        name: "Docker",
        evidence: "Detected Dockerfile or docker-compose definition",
        confidence: "high",
      });
    }

    return [...technologies.values()].sort((left, right) =>
      `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`)
    );
  }

  identifyEntryPoints(snapshot: RepositorySnapshot): EntryPointCandidate[] {
    const entryPoints: EntryPointCandidate[] = [];
    const packageJson = parsePackageJson(snapshot.manifests["package.json"]);

    if (packageJson?.main && typeof packageJson.main === "string") {
      entryPoints.push({
        path: normalizePath(packageJson.main),
        reason: "Declared as package.json main entry.",
        confidence: "high",
      });
    }

    const wellKnownEntries = [
      "src/main.ts",
      "src/index.ts",
      "src/app.ts",
      "src/main.js",
      "src/index.js",
      "index.ts",
      "index.js",
      "server.ts",
      "server.js",
      "main.py",
      "app.py",
      "cmd/main.go",
      "main.go",
    ];

    for (const candidate of wellKnownEntries) {
      if (snapshot.files.includes(candidate)) {
        entryPoints.push({
          path: candidate,
          reason: "Matches a common application entry filename.",
          confidence: candidate.startsWith("src/") ? "high" : "medium",
        });
      }
    }

    return uniqueByPath(entryPoints).sort((left, right) => left.path.localeCompare(right.path));
  }

  detectConfigFiles(snapshot: RepositorySnapshot): ConfigFileCandidate[] {
    return snapshot.files
      .filter((file) => isConfigFile(file))
      .map((file) => ({
        path: file,
        category: classifyConfigFile(file),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  listDependencies(snapshot: RepositorySnapshot): DependencyRecord[] {
    const dependencies: DependencyRecord[] = [];
    const packageJson = parsePackageJson(snapshot.manifests["package.json"]);

    if (packageJson) {
      for (const [dependencyType, record] of [
        ["dependencies", packageJson.dependencies],
        ["devDependencies", packageJson.devDependencies],
        ["peerDependencies", packageJson.peerDependencies],
      ] as const) {
        for (const [name, version] of Object.entries(record ?? {})) {
          if (typeof version !== "string") {
            continue;
          }

          dependencies.push({
            ecosystem: "npm",
            name,
            version,
            sourcePath: "package.json",
            dependencyType,
          });
        }
      }
    }

    const requirements = snapshot.manifests["requirements.txt"];
    if (requirements) {
      for (const line of requirements.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const [name, version = "unspecified"] = trimmed.split(/==|>=|<=|~=|!=/);
        const dependencyName = name?.trim();

        if (!dependencyName) {
          continue;
        }

        dependencies.push({
          ecosystem: "pip",
          name: dependencyName,
          version: version.trim() || "unspecified",
          sourcePath: "requirements.txt",
        });
      }
    }

    const goMod = snapshot.manifests["go.mod"];
    if (goMod) {
      for (const line of goMod.split(/\r?\n/)) {
        const match = line.trim().match(/^([A-Za-z0-9./_-]+)\s+v([0-9][^\s]*)$/);
        if (!match) {
          continue;
        }

        const dependencyName = match[1];
        const dependencyVersion = match[2];
        if (!dependencyName || !dependencyVersion) {
          continue;
        }

        dependencies.push({
          ecosystem: "go",
          name: dependencyName,
          version: dependencyVersion,
          sourcePath: "go.mod",
        });
      }
    }

    return dependencies.sort((left, right) =>
      `${left.ecosystem}:${left.name}`.localeCompare(`${right.ecosystem}:${right.name}`)
    );
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const snapshot = await this.collectRepositorySnapshot(input);
    const report: RepositoryScanReport = {
      structure: this.analyzeStructure(snapshot),
      technologies: this.detectTechnologies(snapshot),
      entryPoints: this.identifyEntryPoints(snapshot),
      configFiles: this.detectConfigFiles(snapshot),
      dependencies: this.listDependencies(snapshot),
    };

    this.remember("last_repository_scan", report);
    this.updateNotes({
      repo_scan_summary: `Scanned ${report.structure.files.length} files and detected ${report.technologies.length} technologies.`,
      repo_scan_source_roots: report.structure.sourceRoots,
    });

    return this.buildExecutionResult({
      summary: `Scanned ${report.structure.files.length} file(s) and identified ${report.entryPoints.length} entry point(s).`,
      output: {
        report,
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: "intake",
    });
  }
}

async function scanWorkspace(rootPath: string, maxFiles: number): Promise<RepositorySnapshot> {
  const resolvedRoot = path.resolve(rootPath);
  const files: string[] = [];
  const directories = new Set<string>();
  const manifests: Record<string, string> = {};

  async function visit(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = normalizePath(path.relative(resolvedRoot, fullPath));

      if (entry.isDirectory()) {
        directories.add(relativePath);
        await visit(fullPath);
        continue;
      }

      if (files.length >= maxFiles) {
        return;
      }

      files.push(relativePath);

      if (shouldReadManifest(relativePath)) {
        manifests[relativePath] = await fs.readFile(fullPath, "utf8");
      }
    }
  }

  await visit(resolvedRoot);

  return {
    rootPath: resolvedRoot,
    directories: [...directories],
    files,
    manifests,
  };
}

function extractManifestContents(files: TaskFileSnapshot[]): Record<string, string> {
  return files.reduce<Record<string, string>>((accumulator, file) => {
    if (file.content && shouldReadManifest(file.path)) {
      accumulator[normalizePath(file.path)] = file.content;
    }

    return accumulator;
  }, {});
}

function inferDirectories(filePaths: string[]): string[] {
  const directories = new Set<string>();

  for (const filePath of filePaths) {
    const segments = normalizePath(filePath).split("/");
    segments.pop();

    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      directories.add(current);
    }
  }

  return [...directories];
}

function shouldReadManifest(filePath: string): boolean {
  const normalizedPath = normalizePath(filePath);
  return [
    "package.json",
    "requirements.txt",
    "go.mod",
    "Cargo.toml",
    "pyproject.toml",
  ].includes(path.posix.basename(normalizedPath));
}

function parsePackageJson(contents: string | undefined): PackageJsonRecord | undefined {
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
  main?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
};

function getPackageDependencyNames(packageJson: PackageJsonRecord): string[] {
  return uniqueStrings([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);
}

function addPackageTechnology(
  technologies: Map<string, DetectedTechnology>,
  dependencyNames: string[],
  dependencyName: string,
  kind: TechnologyKind,
  label: string
): void {
  if (!dependencyNames.includes(dependencyName)) {
    return;
  }

  technologies.set(`${kind}:${label}`, {
    kind,
    name: label,
    evidence: `Detected ${dependencyName} in package.json dependencies.`,
    confidence: "high",
  });
}

function uniqueByPath<T extends { path: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const entry of entries) {
    if (seen.has(entry.path)) {
      continue;
    }

    seen.add(entry.path);
    unique.push(entry);
  }

  return unique;
}

function isConfigFile(filePath: string): boolean {
  const normalizedPath = normalizePath(filePath);
  const baseName = path.posix.basename(normalizedPath);

  return (
    baseName.startsWith(".env") ||
    baseName === "package.json" ||
    baseName === "tsconfig.json" ||
    baseName === "pyproject.toml" ||
    baseName === "go.mod" ||
    baseName === "Cargo.toml" ||
    /\.config\.(?:js|cjs|mjs|ts|json)$/i.test(baseName) ||
    /\.(?:ya?ml|json|toml)$/i.test(baseName)
  );
}

function classifyConfigFile(filePath: string): string {
  const baseName = path.posix.basename(normalizePath(filePath));

  if (baseName.startsWith(".env")) {
    return "environment";
  }

  if (baseName === "package.json") {
    return "package";
  }

  if (/\.config\./i.test(baseName) || baseName === "tsconfig.json") {
    return "tooling";
  }

  return "application";
}

function normalizePath(value: string): string {
  return value.replaceAll(path.sep, "/").replace(/^\.\/+/, "");
}
