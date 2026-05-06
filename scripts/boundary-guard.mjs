import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scannedEntries = ["package.json", "apps", "packages"];
const ignoredDirs = new Set(["dist", "node_modules", "coverage", ".git"]);
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);
const forbiddenModules = ["ai-conversation", "ai-pms", "pi-agent-core"];
const moduleRules = forbiddenModules.map((moduleName) => ({
  id: `${moduleName} runtime dependency`,
  pattern: new RegExp(`(?:from|import)\\s+["'][^"']*${moduleName}[^"']*["']|["']${moduleName}["']|${moduleName.replace(/-/g, "-")}\\/src`)
}));

const rules = [
  ...moduleRules,
  { id: "old replies output contract", pattern: /\bbody\.replies\b|\breplies\s*:\s*\[/ },
  { id: "v1-v2 compatibility module", pattern: /compat(?:ibility)?[-_/]?(?:v1|v2)|(?:v1|v2)[-_/]?compat(?:ibility)?/i }
];

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
  if (entryStat.isFile()) {
    return scannedExtensions.has(path.extname(entryPath)) ? [entryPath] : [];
  }
  if (!entryStat.isDirectory()) return [];
  if (ignoredDirs.has(path.basename(entryPath))) return [];

  const children = await readdir(entryPath);
  const nested = await Promise.all(children.map((child) => collectFiles(path.join(entryPath, child))));
  return nested.flat();
}

export async function scanPath(root = defaultRoot) {
  const files = [];
  for (const entry of scannedEntries) {
    const entryPath = path.join(root, entry);
    if (await exists(entryPath)) files.push(...await collectFiles(entryPath));
  }

  const violations = [];
  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");
    for (const rule of rules) {
      if (rule.pattern.test(text)) {
        violations.push({ file: path.relative(root, filePath), rule: rule.id });
      }
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : defaultRoot;
  const violations = await scanPath(root);
  if (violations.length > 0) {
    console.error("Boundary guard failed:");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.rule}`);
    }
    process.exit(1);
  }
  console.log("Boundary guard passed.");
}
