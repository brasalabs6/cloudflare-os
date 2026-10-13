import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkReadmePackages } from "./check-readme-packages.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "readme-packages-"));
  mkdirSync(join(root, "packages", "active"), { recursive: true });
  mkdirSync(join(root, "packages", "planned"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n  - scripts\n\ncatalog:\n  vite: ^7\n");
  writeFileSync(join(root, "packages", "active", "package.json"), '{"name":"@example/active"}');
  writeFileSync(join(root, "scripts", "package.json"), '{"name":"@example/scripts"}');
  const row = (path, name) => `| [\`${path}\`](${path}/) | ${name} | Description |`;
  const rows = [
    row("packages/active", "`@example/active`"),
    row("packages/planned", "—"),
    row("scripts", "`@example/scripts`"),
  ];
  const write = (customRows = rows) => writeFileSync(join(root, "README.md"),
    `# Project\n\n<!-- package-inventory:start -->\n| Directory | Package | Role |\n| --- | --- | --- |\n${customRows.join("\n")}\n<!-- package-inventory:end -->\n`);
  write();
  return { root, row, rows, write };
}

function withFixture(run) {
  const f = fixture();
  try { run(f); } finally { rmSync(f.root, { recursive: true, force: true }); }
}

test("accepts all workspace packages and planned directory", () => withFixture(({ root }) => {
  assert.deepEqual(checkReadmePackages(root), []);
}));

test("detects a newly added package directory", () => withFixture(({ root }) => {
  mkdirSync(join(root, "packages", "new-module"));
  assert.match(checkReadmePackages(root).join("\n"), /Missing inventory entry: packages\/new-module/);
}));

test("rejects stale, duplicate and incorrectly named packages", () => withFixture(({ root, rows, row, write }) => {
  write([...rows, row("packages/old", "`@example/old`"), rows[0]]);
  assert.match(checkReadmePackages(root).join("\n"), /Stale inventory entry/);
  assert.match(checkReadmePackages(root).join("\n"), /Duplicate inventory entry/);
  write([row("packages/active", "`@example/wrong`"), ...rows.slice(1)]);
  assert.match(checkReadmePackages(root).join("\n"), /differs from package.json/);
}));

test("fails closed if workspace patterns change", () => withFixture(({ root }) => {
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n  - scripts\n  - apps/*\n");
  assert.match(checkReadmePackages(root).join("\n"), /Workspace paths changed/);
}));
