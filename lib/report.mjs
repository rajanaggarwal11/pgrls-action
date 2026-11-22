// Turns the pgrls audit's JSON report into step outputs and a job summary.
//
// Role, database, host, schema and table names come from the database, and Postgres lets
// a quoted identifier hold any character, a newline or Markdown included. So:
//   - outputs use the heredoc form with a random delimiter, and every value is one line;
//   - the summary escapes HTML and Markdown in every name and message.
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";

const file = process.argv[2];
const r = JSON.parse(readFileSync(file, "utf8"));
const s = r.summary ?? {};
const by = s.byProblem ?? {};
const unprotected = Array.isArray(r.unprotected) ? r.unprotected : [];

const count = (v) => (Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
// One line: no control characters (CR, LF, NEL included) and no Unicode line separators.
const oneLine = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").trim();
// Safe inside Markdown text and table cells: HTML entities first, then a backslash before
// every character Markdown gives a meaning to (| included, for tables).
const md = (v) =>
  oneLine(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\\`*_{}[\]()#+\-.!|~:@]/g, "\\$&");
const code = (v) => `<code>${md(v)}</code>`;

const tables = count(s.tables);
const total = count(s.unprotected);
const noRls = count(by["no-rls"]);
const notForced = count(by["not-forced"]);
const noPolicies = count(by["no-policies"]);
const bypasses = r.role?.bypasses === true;

if (process.env.GITHUB_OUTPUT) {
  const delimiter = `ghadelimiter_${randomBytes(16).toString("hex")}`;
  const outputs = {
    tables,
    unprotected: total,
    "no-rls": noRls,
    "not-forced": notForced,
    "no-policies": noPolicies,
    role: oneLine(r.role?.name),
    bypasses,
    report: oneLine(file),
  };
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([k, v]) => `${k}<<${delimiter}\n${v}\n${delimiter}\n`)
      .join(""),
  );
}

const role = code(r.role?.name);
const lines = ["## pgrls audit", "", `${code(r.database)} on ${code(r.host)} as ${role} · ${tables} table(s)`, ""];
if (bypasses) {
  lines.push(`> ⚠️ ${role} is a superuser or has BYPASSRLS. Row-level security is never applied to it, so this report proves nothing about this connection. Run the audit as the role your application uses.`, "");
}
if (total === 0) {
  lines.push(r.ok ? "Every table is protected." : "No unprotected tables found.");
} else {
  lines.push(`**${total} of ${tables} table(s) not protected** — ${noRls} without RLS, ${notForced} not forced, ${noPolicies} without policies.`, "");
  lines.push("| Table | Problem | Why it matters |", "| --- | --- | --- |");
  for (const t of unprotected.slice(0, 50)) {
    lines.push(`| ${code(`${t.schema}.${t.table}`)} | ${code(t.problem)} | ${md(t.reason)} |`);
  }
  if (unprotected.length > 50) lines.push(`| | | …and ${unprotected.length - 50} more |`);
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
