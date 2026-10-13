import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const START = "<!-- package-inventory:start -->";
const END = "<!-- package-inventory:end -->";

/** Validate that the README documents every package directory and its actual manifest name. */
export function checkReadmePackages(root) {
  const errors = [];
  const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const workspaceBlock = workspace.match(/^packages:\s*\r?\n((?:^[ \t].*(?:\r?\n|$)|^\s*\r?\n)*)/m)?.[1] ?? "";
  const patterns = [...workspaceBlock.matchAll(/^\s*-\s+['"]?([^'"\s]+)['"]?\s*$/gm)]
    .map((match) => match[1]);
  if (patterns.length !== 2 || !patterns.includes("packages/*") || !patterns.includes("scripts")) {
    errors.push("Workspace paths changed: update this checker to discover the new pnpm-workspace.yaml patterns.");
  }

  const expected = new Map();
  for (const entry of readdirSync(join(root, "packages"), { withFileTypes: true })) {
    if (entry.isDirectory()) expected.set(`packages/${entry.name}`, readPackageName(root, `packages/${entry.name}`));
  }
  expected.set("scripts", readPackageName(root, "scripts"));

  const readme = readFileSync(join(root, "README.md"), "utf8");
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end < start || readme.indexOf(START, start + START.length) !== -1 ||
      readme.indexOf(END, end + END.length) !== -1) {
    return ["README.md must contain exactly one correctly ordered package-inventory marker pair."];
  }

  const seen = new Set();
  const rows = readme.slice(start + START.length, end).split(/\r?\n/)
    .filter((line) => /^\|\s*\[/.test(line));
  const rowPattern = /^\|\s*\[`((?:packages\/[^/]+|scripts))`\]\(([^)]+)\)\s*\|\s*(`[^`]+`|—)\s*\|\s*.+\|\s*$/;
  for (const row of rows) {
    const match = row.match(rowPattern);
    if (!match) { errors.push(`Malformed inventory row: ${row}`); continue; }
    const [, path, href, rawName] = match;
    if (seen.has(path)) errors.push(`Duplicate inventory entry: ${path}`);
    seen.add(path);
    if (!expected.has(path)) { errors.push(`Stale inventory entry: ${path}`); continue; }
    if (href !== `${path}/`) errors.push(`Incorrect link for ${path}: ${href}`);
    const actual = expected.get(path);
    const documented = rawName === "—" ? null : rawName.slice(1, -1);
    if (actual !== documented) {
      errors.push(`${path}: README package name ${JSON.stringify(documented)} differs from package.json ${JSON.stringify(actual)}`);
    }
  }
  for (const path of expected.keys()) {
    if (!seen.has(path)) errors.push(`Missing inventory entry: ${path}`);
  }
  return errors;
}

function readPackageName(root, path) {
  const manifest = join(root, path, "package.json");
  return existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")).name : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const errors = checkReadmePackages(root);
  if (errors.length) {
    console.error("README package inventory is out of sync:\n" + errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("README package inventory matches packages/* and scripts/ manifests.");
  }
}
