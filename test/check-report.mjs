// Runs lib/report.mjs on a report with hostile identifiers and checks what it wrote.
// Parses $GITHUB_OUTPUT the way the runner does: `key=value` lines and
// `key<<DELIMITER` ... `DELIMITER` blocks.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "pgrls-report-"));
const out = join(dir, "output");
const summary = join(dir, "summary");
writeFileSync(out, "");
writeFileSync(summary, "");
execFileSync("node", ["lib/report.mjs", "test/hostile-report.json"], {
  env: { ...process.env, GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary },
  stdio: "inherit",
});

const outputs = {};
const lines = readFileSync(out, "utf8").split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const heredoc = line.match(/^([^=<]+)<<(.+)$/);
  if (heredoc) {
    const value = [];
    for (i++; lines[i] !== heredoc[2]; i++) {
      if (i >= lines.length) throw new Error(`unterminated output ${heredoc[1]}`);
      value.push(lines[i]);
    }
    outputs[heredoc[1]] = value.join("\n");
  } else {
    const eq = line.indexOf("=");
    outputs[line.slice(0, eq)] = line.slice(eq + 1);
  }
}

const failures = [];
const expect = (ok, what) => ok || failures.push(what);
expect(outputs.unprotected === "2", `unprotected is ${JSON.stringify(outputs.unprotected)}, expected "2"`);
expect(outputs.bypasses === "true", `bypasses is ${JSON.stringify(outputs.bypasses)}, expected "true"`);
expect(outputs.tables === "3", `tables is ${JSON.stringify(outputs.tables)}, expected "3"`);
expect(!/[\r\n]/.test(outputs.role ?? "x\n"), "role output spans lines");

const md = readFileSync(summary, "utf8");
for (const raw of ["<img", "<script", "<details", "## forged", "[link](", "**RLS**", "\u2028", "\u0085"]) {
  expect(!md.includes(raw), `the summary contains raw ${JSON.stringify(raw)}`);
}
const rows = md.split("\n").filter((l) => l.startsWith("| <code>"));
expect(rows.length === 2, `expected 2 table rows, got ${rows.length}`);
for (const row of rows) {
  const cells = row.replace(/\\\|/g, "").split("|").length - 2;
  expect(cells === 3, `a row has ${cells} cells: ${row}`);
}

if (failures.length) {
  console.log(md);
  for (const f of failures) console.log(`::error::${f}`);
  process.exit(1);
}
console.log("outputs and summary are safe:", JSON.stringify(outputs.role));
