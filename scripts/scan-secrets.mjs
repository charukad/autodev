import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", ".github", "coverage", "dist", "docs", "node_modules"]);
const allowedExtensions = new Set([
  ".cjs",
  ".env",
  ".js",
  ".json",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const skippedFiles = new Set([".env.example", "package-lock.json"]);
const patterns = [
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "OpenAI key", regex: /sk-[a-zA-Z0-9]{20,}/g },
  { name: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "Private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "Hardcoded password", regex: /password\s*[:=]\s*["'][^"']{8,}["']/gi },
];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function shouldScan(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  const extension = path.extname(filePath);
  const fileName = path.basename(filePath);

  if (skippedFiles.has(fileName)) {
    return false;
  }

  if (relativePath.endsWith(".md")) {
    return false;
  }

  return allowedExtensions.has(extension) || fileName === ".env";
}

async function main() {
  const findings = [];
  const files = await walk(repoRoot);

  for (const filePath of files) {
    if (!shouldScan(filePath)) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");

    for (const pattern of patterns) {
      if (!pattern.regex.test(content)) {
        continue;
      }

      findings.push({
        file: path.relative(repoRoot, filePath),
        pattern: pattern.name,
      });
    }
  }

  if (findings.length === 0) {
    console.log("Secret scan passed.");
    return;
  }

  console.error("Potential secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.pattern}`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Secret scan failed:", error);
  process.exitCode = 1;
});
