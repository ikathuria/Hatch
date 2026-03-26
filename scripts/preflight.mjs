import { spawnSync } from "node:child_process";

const npmCmd = "npm";

const run = (cmd, cmdArgs, env = {}) => {
  const res = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env }
  });
  if (res.error) {
    throw new Error(
      `Command failed to start: ${cmd} ${cmdArgs.join(" ")} (${res.error.message})`
    );
  }
  if (res.status !== 0) {
    throw new Error(
      `Command failed: ${cmd} ${cmdArgs.join(" ")} (exit ${String(res.status)})`
    );
  }
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.replace(/^['"]|['"]$/g, "");
};

const smokeCheck = async (baseUrl) => {
  const targets = [
    { path: "/api/health", expect: [200] },
    { path: "/api/events", expect: [200] },
    { path: "/organizer/login", expect: [200] }
  ];

  for (const target of targets) {
    const url = new URL(target.path, baseUrl).toString();
    const res = await fetch(url, { redirect: "follow" });
    if (!target.expect.includes(res.status)) {
      throw new Error(`Smoke check failed for ${url}. Expected ${target.expect.join("/")}, got ${res.status}.`);
    }
    console.log(`[smoke] ${target.path} -> ${res.status}`);
  }
};

const main = async () => {
  console.log("\n[preflight] Building app...");
  run(npmCmd, ["run", "build"], { ASTRO_TELEMETRY_DISABLED: "1" });

  const d1Env = process.env.D1_ENV || "";
  const d1Database = process.env.D1_DATABASE || (d1Env === "staging" ? "hatch-staging" : "hatch");
  const d1Args = ["scripts/apply-d1-migrations.mjs", "--database", d1Database, "--dry-run", "--fail-on-pending"];
  if (process.env.D1_REMOTE === "1") d1Args.push("--remote");
  if (d1Env) d1Args.push("--env", d1Env);

  if (process.env.SKIP_MIGRATION_STATUS === "1") {
    console.log("\n[preflight] Skipping migration status check (SKIP_MIGRATION_STATUS=1).");
  } else {
    console.log(`\n[preflight] Checking migration status (db=${d1Database}${d1Env ? `, env=${d1Env}` : ""})...`);
    run("node", d1Args);
  }

  const smokeBase = requireEnv("SMOKE_BASE_URL");
  console.log(`\n[preflight] Running smoke checks against ${smokeBase} ...`);
  await smokeCheck(smokeBase);
  console.log("\n[preflight] Success.");
};

main().catch((error) => {
  console.error(`\n[preflight] Failed: ${error.message}`);
  process.exit(1);
});
