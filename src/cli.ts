#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderText, scanWorkflows, writeReports } from "./index.js";

interface CliOptions {
  command: "scan" | "demo" | "help";
  root: string;
  json: boolean;
  out?: string;
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  if (options.command === "demo") {
    const demoRoot = await createDemoWorkspace(options.out ?? path.join(process.cwd(), "reports", "demo-workspace"));
    const result = await scanWorkflows({ root: demoRoot });
    const reportDir = path.join(process.cwd(), "reports", "demo");
    await writeReports(result, reportDir);
    console.log(options.json ? JSON.stringify(result, null, 2) : renderText(result));
    if (!options.json) console.log(`Reports written to ${reportDir}`);
    return;
  }

  const result = await scanWorkflows({ root: options.root });
  if (options.out) {
    const files = await writeReports(result, options.out);
    if (!options.json) {
      console.log(renderText(result));
      console.log(`Reports written to ${files.markdown}`);
    }
    return;
  }

  console.log(options.json ? JSON.stringify(result, null, 2) : renderText(result));
}

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const command = readCommand(args);
  let root = process.cwd();
  let json = false;
  let out: string | undefined;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;
    if (arg === "--help" || arg === "-h") return { command: "help", root, json, out };
    if (arg === "--root") {
      root = requireValue(args, "--root");
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--out") {
      out = requireValue(args, "--out");
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      root = arg;
    }
  }

  return { command, root, json, out };
}

function readCommand(args: string[]): CliOptions["command"] {
  const first = args[0];
  if (first === "scan" || first === "demo") {
    args.shift();
    return first;
  }
  if (first === "help" || first === "--help" || first === "-h") {
    args.shift();
    return "help";
  }
  return "scan";
}

function requireValue(args: string[], option: string): string {
  const value = args.shift();
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

async function createDemoWorkspace(root: string): Promise<string> {
  const resolved = path.resolve(root);
  await rm(resolved, { recursive: true, force: true });
  await mkdir(path.join(resolved, ".github", "workflows"), { recursive: true });
  await writeFile(
    path.join(resolved, ".github", "workflows", "release.yml"),
    [
      "name: Release",
      "on:",
      "  push:",
      "    branches: [main]",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  publish:",
      "    runs-on: ubuntu-latest",
      "    permissions:",
      "      contents: write",
      "      packages: write",
      "    steps:",
      "      - run: npm publish"
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(resolved, ".github", "workflows", "review.yml"),
    [
      "name: Review",
      "on: pull_request_target",
      "jobs:",
      "  triage:",
      "    runs-on: ubuntu-latest",
      "    permissions: write-all",
      "    steps:",
      "      - run: echo risky"
    ].join("\n"),
    "utf8"
  );
  return resolved;
}

function helpText(): string {
  return `gha-permission-map

Map GitHub Actions token permissions, triggers, and risky combinations.

Usage:
  gha-permission-map scan [root] [--json] [--out <dir>]
  gha-permission-map demo [--json] [--out <workspace-dir>]

Examples:
  gha-permission-map scan .
  gha-permission-map scan . --out reports/gha-permission-map
  gha-permission-map demo
`;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`gha-permission-map: ${message}`);
  process.exitCode = 1;
});
