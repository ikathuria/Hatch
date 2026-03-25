import { spawnSync } from "node:child_process";

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (cmd, cmdArgs) => {
  const res = spawnSync(cmd, cmdArgs, { stdio: "inherit", shell: false });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${cmdArgs.join(" ")}`);
  }
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
  run(npmCmd, ["run", "build"]);

  const d1Database = process.env.D1_DATABASE || "hatch";
  const d1Args = ["scripts/apply-d1-migrations.mjs", "--database", d1Database, "--dry-run", "--fail-on-pending"];
  if (process.env.D1_REMOTE === "1") d1Args.push("--remote");
  if (process.env.D1_ENV) d1Args.push("--env", process.env.D1_ENV);

  console.log("\n[preflight] Checking migration status...");
  run("node", d1Args);

  const smokeBase = requireEnv("SMOKE_BASE_URL");
  console.log(`\n[preflight] Running smoke checks against ${smokeBase} ...`);
  await smokeCheck(smokeBase);
  console.log("\n[preflight] Success.");
};

main().catch((error) => {
  console.error(`\n[preflight] Failed: ${error.message}`);
  process.exit(1);
});

