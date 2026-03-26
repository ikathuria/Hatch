import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const raw = process.argv[i];
  if (!raw.startsWith("--")) continue;
  const key = raw.slice(2);
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) {
    args.set(key, "true");
  } else {
    args.set(key, next);
    i += 1;
  }
}

const database = args.get("database") || process.env.D1_DATABASE || "hatch";
const migrationsDir = path.resolve(args.get("migrations-dir") || "db/migrations");
const bootstrapSchema = path.resolve(args.get("bootstrap-schema") || "db/schema.sql");
const remote = args.get("remote") === "true";
const envName = args.get("env");
const dryRun = args.get("dry-run") === "true";
const failOnPending = args.get("fail-on-pending") === "true";

const wranglerJs = path.resolve("node_modules/wrangler/bin/wrangler.js");
const nodeBin = process.execPath;

if (!fs.existsSync(wranglerJs)) {
  throw new Error(`Wrangler entrypoint not found: ${wranglerJs}`);
}

const run = (cmdArgs, { allowFailure = false } = {}) => {
  const res = spawnSync(nodeBin, [wranglerJs, ...cmdArgs], {
    stdio: "pipe",
    encoding: "utf8",
    shell: false
  });

  if (res.error && !allowFailure) {
    throw new Error(
      `Command failed to start: ${nodeBin} ${wranglerJs} ${cmdArgs.join(" ")} (${res.error.code || "ERR"}: ${res.error.message})`
    );
  }

  if (res.status !== 0 && !allowFailure) {
    const stderr = (res.stderr || "").trim();
    const stdout = (res.stdout || "").trim();
    const details = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(
      `Command failed: ${nodeBin} ${wranglerJs} ${cmdArgs.join(" ")}\n${details || "Unknown error"}`
    );
  }

  return res;
};

const d1Execute = ({ command, file, json = false }) => {
  const cmd = ["d1", "execute", database];
  if (envName) {
    cmd.push("--env", envName);
  }
  cmd.push(remote ? "--remote" : "--local");
  if (command) cmd.push("--command", command);
  if (file) cmd.push("--file", file);
  if (json) cmd.push("--json");
  return run(cmd);
};

const d1Rows = (sql) => {
  const out = d1Execute({ command: sql, json: true }).stdout.trim();
  const starts = ["[", "{"]
    .map((token) => out.indexOf(token))
    .filter((idx) => idx >= 0);
  const jsonStart = starts.length ? Math.min(...starts) : -1;
  const parsed = JSON.parse(jsonStart >= 0 ? out.slice(jsonStart) : out);
  if (Array.isArray(parsed) && parsed[0]?.results) return parsed[0].results;
  if (parsed?.results) return parsed.results;
  return [];
};

const hasTable = (table) =>
  d1Rows(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table.replace(/'/g, "''")}'`
  ).length > 0;

const tableColumns = (table) =>
  d1Rows(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).map((row) =>
    String(row.name || "").toLowerCase()
  );

const hasColumn = (table, column) => tableColumns(table).includes(column.toLowerCase());

const hasCompositeEventsSlugConstraint = () => {
  const indexes = d1Rows("PRAGMA index_list('events')");
  for (const idx of indexes) {
    if (!idx.unique) continue;
    const idxName = String(idx.name || "");
    const cols = d1Rows(`PRAGMA index_info('${idxName.replace(/'/g, "''")}')`).map((row) =>
      String(row.name || "").toLowerCase()
    );
    if (cols.length === 2 && cols.includes("organizer_id") && cols.includes("slug")) {
      return true;
    }
  }
  return false;
};

const ensureMigrationTable = () => {
  d1Execute({
    command:
      "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)"
  });
};

const checksum = (absPath) =>
  createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");

const shouldApply = (migrationId) => {
  if (migrationId === "01_add_org_social.sql") {
    return !["organization_name", "website_url", "twitter_url", "discord_url", "max_participants"].every(
      (col) => hasColumn("events", col)
    );
  }
  if (migrationId === "02_banner_url.sql") {
    return !hasColumn("events", "banner_url");
  }
  if (migrationId === "03_judging_and_participants.sql") {
    return !hasColumn("events", "results_status") || !hasTable("event_rubrics");
  }
  if (migrationId === "04_participant_vote_identity.sql") {
    return !hasColumn("submission_votes", "participant_email");
  }
  if (migrationId === "05_scope_event_slug_to_organizer.sql") {
    return !hasCompositeEventsSlugConstraint();
  }
  if (migrationId === "06_reconcile_submission_votes_identity.sql") {
    return hasColumn("submission_votes", "normalized_email");
  }
  if (migrationId === "07_add_request_rate_limits.sql") {
    return !hasTable("request_rate_limits");
  }
  return true;
};

const markApplied = (id, sum) => {
  const idEsc = id.replace(/'/g, "''");
  d1Execute({
    command: `INSERT OR REPLACE INTO schema_migrations (id, checksum, applied_at) VALUES ('${idEsc}', '${sum}', datetime('now'))`
  });
};

const listMigrationFiles = () =>
  fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

const assertStagingConfig = () => {
  if (envName !== "staging") return;
  const wranglerTomlPath = path.resolve("wrangler.toml");
  if (!fs.existsSync(wranglerTomlPath)) return;
  const body = fs.readFileSync(wranglerTomlPath, "utf8");
  if (body.includes("REPLACE_WITH_STAGING_D1_DATABASE_ID")) {
    throw new Error(
      "wrangler.toml still has REPLACE_WITH_STAGING_D1_DATABASE_ID. Set the real staging D1 id before running staged migration checks."
    );
  }
};

const main = () => {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  if (!fs.existsSync(bootstrapSchema)) {
    throw new Error(`Schema file not found: ${bootstrapSchema}`);
  }
  assertStagingConfig();

  console.log(`\n[db] Using database "${database}" (${remote ? "remote" : "local"})`);
  if (envName) console.log(`[db] Wrangler env: ${envName}`);

  if (!dryRun) {
    ensureMigrationTable();
  }

  // Safe bootstrap for fresh environments.
  if (!dryRun) {
    console.log("[db] Applying bootstrap schema (db/schema.sql)...");
    d1Execute({ file: bootstrapSchema });
  }

  const appliedRows =
    hasTable("schema_migrations")
      ? d1Rows("SELECT id, checksum FROM schema_migrations ORDER BY id ASC")
      : [];
  const applied = new Map(appliedRows.map((row) => [String(row.id), String(row.checksum)]));

  const migrations = listMigrationFiles();
  const actionable = [];
  const satisfied = [];

  for (const fileName of migrations) {
    const abs = path.join(migrationsDir, fileName);
    const sum = checksum(abs);
    const already = applied.get(fileName);
    if (already) {
      if (already !== sum) {
        throw new Error(
          `Migration checksum mismatch for ${fileName}. Expected ${already}, got ${sum}.`
        );
      }
      continue;
    }

    const apply = shouldApply(fileName);
    if (apply) {
      actionable.push({ fileName, abs, sum, apply: true });
    } else {
      satisfied.push({ fileName, abs, sum, apply: false });
    }
  }

  if (actionable.length === 0 && satisfied.length === 0) {
    console.log("[db] Migration status: clean (no pending changes)");
    return;
  }

  if (actionable.length > 0) {
    console.log("[db] Pending migrations (will apply):");
    for (const entry of actionable) {
      console.log(`  - ${entry.fileName}`);
    }
  }
  if (satisfied.length > 0) {
    console.log("[db] Untracked migrations already satisfied by schema:");
    for (const entry of satisfied) {
      console.log(`  - ${entry.fileName}`);
    }
  }

  if (dryRun) {
    if (failOnPending && actionable.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  for (const entry of actionable) {
    if (entry.apply) {
      console.log(`[db] Applying ${entry.fileName}...`);
      d1Execute({ file: entry.abs });
    } else {
      console.log(`[db] Recording ${entry.fileName} as satisfied...`);
    }
    markApplied(entry.fileName, entry.sum);
  }

  for (const entry of satisfied) {
    console.log(`[db] Recording ${entry.fileName} as satisfied...`);
    markApplied(entry.fileName, entry.sum);
  }

  console.log("[db] Migration apply complete.");
};

main();
