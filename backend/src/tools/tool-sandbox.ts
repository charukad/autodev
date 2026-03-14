import { promises as fs, realpathSync } from "node:fs";
import path from "node:path";
import { ToolSecurityError } from "./tool-errors";
import { extractPatchPaths, getRelativeProjectPath } from "./tool-utils";

export type SandboxAccess = "read" | "write" | "list";

export type ResolvedSandboxPath = {
  absolutePath: string;
  relativePath: string;
};

export type ToolSandboxOptions = {
  projectRoot?: string;
};

const blockedRootCommands = new Set([
  "chmod",
  "chown",
  "dd",
  "diskutil",
  "format",
  "halt",
  "killall",
  "launchctl",
  "mkfs",
  "passwd",
  "poweroff",
  "reboot",
  "rm",
  "shutdown",
  "sudo",
  "su",
  "systemctl",
  "useradd",
  "userdel",
]);

const blockedGitSubcommands = new Set([
  "checkout",
  "clean",
  "push",
  "rebase",
  "reset",
  "restore",
  "switch",
]);

export class ToolSandboxPolicy {
  readonly projectRoot: string;

  constructor(options: ToolSandboxOptions = {}) {
    const resolvedProjectRoot = path.resolve(options.projectRoot ?? process.cwd());

    try {
      this.projectRoot = realpathSync(resolvedProjectRoot);
    } catch {
      this.projectRoot = resolvedProjectRoot;
    }
  }

  async resolveReadablePath(candidatePath: string): Promise<ResolvedSandboxPath> {
    return this.resolvePath(candidatePath, "read");
  }

  async resolveWritablePath(candidatePath: string): Promise<ResolvedSandboxPath> {
    return this.resolvePath(candidatePath, "write");
  }

  async resolveListPath(candidatePath: string): Promise<ResolvedSandboxPath> {
    return this.resolvePath(candidatePath, "list");
  }

  async resolveWorkingDirectory(candidatePath?: string): Promise<ResolvedSandboxPath> {
    return this.resolvePath(candidatePath ?? ".", "list");
  }

  isPathVisible(relativePath: string, access: SandboxAccess = "list"): boolean {
    const normalizedPath = relativePath === "." ? "." : relativePath.replaceAll("\\", "/");
    return !this.isBlockedPath(normalizedPath, access);
  }

  assertCommandAllowed(command: string): void {
    const trimmedCommand = command.trim();

    if (trimmedCommand.length === 0) {
      throw new ToolSecurityError("Command cannot be empty.");
    }

    const blockedShellOperators = ["&&", "||", ";", "|", ">", "<", "`", "$("];

    for (const operator of blockedShellOperators) {
      if (trimmedCommand.includes(operator)) {
        throw new ToolSecurityError("Shell control operators are blocked by the tool sandbox.", {
          command: trimmedCommand,
          operator,
        });
      }
    }

    const tokens = trimmedCommand.split(/\s+/);
    const executable = tokens[0];

    if (!executable) {
      throw new ToolSecurityError("Command cannot be empty.");
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(executable)) {
      throw new ToolSecurityError("Inline environment variable assignment is blocked.", {
        command: trimmedCommand,
      });
    }

    const commandName = path.basename(executable);

    if (blockedRootCommands.has(commandName)) {
      throw new ToolSecurityError(`Command "${commandName}" is blocked by the tool sandbox.`, {
        command: trimmedCommand,
      });
    }

    if (commandName === "git" && tokens[1] && blockedGitSubcommands.has(tokens[1])) {
      throw new ToolSecurityError(`Git subcommand "${tokens[1]}" is blocked by the tool sandbox.`, {
        command: trimmedCommand,
      });
    }
  }

  async assertPatchAllowed(diff: string): Promise<string[]> {
    const patchPaths = extractPatchPaths(diff);

    if (patchPaths.length === 0) {
      throw new ToolSecurityError("Patch must reference at least one file.");
    }

    for (const patchPath of patchPaths) {
      await this.resolveWritablePath(patchPath);
    }

    return patchPaths;
  }

  private async resolvePath(
    candidatePath: string,
    access: SandboxAccess
  ): Promise<ResolvedSandboxPath> {
    if (candidatePath.trim().length === 0) {
      throw new ToolSecurityError("Path cannot be empty.");
    }

    const requestedPath = path.isAbsolute(candidatePath)
      ? path.normalize(candidatePath)
      : path.resolve(this.projectRoot, candidatePath);
    const realProjectRoot = await this.getRealProjectRoot();
    const realRequestedPath = await this.resolveRealPath(requestedPath);
    const relativePath = getRelativeProjectPath(realProjectRoot, realRequestedPath);

    if (relativePath.startsWith("../") || relativePath === "..") {
      throw new ToolSecurityError("Path is outside the project root.", {
        path: candidatePath,
      });
    }

    if (!this.isPathVisible(relativePath, access)) {
      throw new ToolSecurityError("Path is blocked by the tool sandbox.", {
        path: relativePath,
        access,
      });
    }

    return {
      absolutePath: realRequestedPath,
      relativePath,
    };
  }

  private async getRealProjectRoot(): Promise<string> {
    try {
      return await fs.realpath(this.projectRoot);
    } catch {
      return this.projectRoot;
    }
  }

  private async resolveRealPath(candidatePath: string): Promise<string> {
    try {
      return await fs.realpath(candidatePath);
    } catch {
      const existingAncestor = await this.findExistingAncestor(candidatePath);
      const realAncestor = await fs.realpath(existingAncestor);
      const remainder = path.relative(existingAncestor, candidatePath);
      return path.resolve(realAncestor, remainder);
    }
  }

  private async findExistingAncestor(candidatePath: string): Promise<string> {
    let currentPath = candidatePath;

    while (true) {
      try {
        await fs.access(currentPath);
        return currentPath;
      } catch {
        const parentPath = path.dirname(currentPath);

        if (parentPath === currentPath) {
          throw new ToolSecurityError("Unable to resolve a path inside the project root.", {
            path: candidatePath,
          });
        }

        currentPath = parentPath;
      }
    }
  }

  private isBlockedPath(relativePath: string, access: SandboxAccess): boolean {
    if (relativePath === ".") {
      return false;
    }

    const segments = relativePath.split("/").filter(Boolean);
    const basename = segments.at(-1) ?? "";

    if (segments.includes(".git") || segments.includes(".ssh") || segments.includes(".aws")) {
      return true;
    }

    if (basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) {
      return true;
    }

    if (/\.(pem|key)$/i.test(basename)) {
      return true;
    }

    if (
      access === "write" &&
      segments.some((segment) => ["coverage", "dist", "node_modules"].includes(segment))
    ) {
      return true;
    }

    if (
      access === "list" &&
      segments.some((segment) => ["coverage", "dist", "node_modules"].includes(segment))
    ) {
      return true;
    }

    return false;
  }
}
