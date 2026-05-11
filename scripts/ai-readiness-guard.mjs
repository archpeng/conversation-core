import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scannedEntries = ["apps", "packages", "scripts", "tests"];
const ignoredDirs = new Set(["dist", "node_modules", "coverage", ".git"]);
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const sourceLineBudget = 350;
const testLineBudget = 500;

const riskyPatterns = [
  { id: "forbidden cast: partial", pattern: /\bas\s+Partial</ },
  { id: "forbidden cast: never", pattern: /\bas\s+never\b/ },
  { id: "forbidden cast: double", pattern: /\bas\s+[^;\n]+?\s+as\s+/ },
  { id: "forbidden any type", pattern: /(:\s*any\b|\bas\s+any\b)/ }
];

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isTestFile(relativeFile) {
  const normalized = normalizeRelativePath(relativeFile);
  return normalized.startsWith("tests/") || /\.test\.[cm]?[jt]sx?$/.test(normalized);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(entryPath) {
  const entryStat = await stat(entryPath);
  if (entryStat.isFile()) return scannedExtensions.has(path.extname(entryPath)) ? [entryPath] : [];
  if (!entryStat.isDirectory()) return [];
  if (ignoredDirs.has(path.basename(entryPath))) return [];

  const children = await readdir(entryPath);
  const nested = await Promise.all(children.map((child) => collectFiles(path.join(entryPath, child))));
  return nested.flat();
}

function lineCount(text) {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

export async function scanPath(root = defaultRoot) {
  const files = [];
  for (const entry of scannedEntries) {
    const entryPath = path.join(root, entry);
    if (await exists(entryPath)) files.push(...await collectFiles(entryPath));
  }

  const violations = [];
  for (const filePath of files) {
    const relativeFile = path.relative(root, filePath);
    const normalizedFile = normalizeRelativePath(relativeFile);
    const text = await readFile(filePath, "utf8");
    const lines = lineCount(text);
    const budget = isTestFile(normalizedFile) ? testLineBudget : sourceLineBudget;
    if (lines > budget) {
      violations.push({ file: relativeFile, rule: `line budget exceeded: ${lines}/${budget}` });
    }
    if (!isTestFile(normalizedFile)) {
      for (const rule of riskyPatterns) {
        if (rule.pattern.test(text)) violations.push({ file: relativeFile, rule: rule.id });
      }
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : defaultRoot;
  const violations = await scanPath(root);
  if (violations.length > 0) {
    console.error("AI-readiness guard failed:");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.rule}`);
    }
    process.exit(1);
  }
  console.log("AI-readiness guard passed.");
}
