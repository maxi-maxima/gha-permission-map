import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { scanWorkflows } from "../src/index.js";

async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "gha-permission-map-"));
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(
    path.join(root, ".github", "workflows", "release.yml"),
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
    ].join("\n")
  );
  await writeFile(
    path.join(root, ".github", "workflows", "review.yml"),
    [
      "name: Review",
      "on: pull_request_target",
      "jobs:",
      "  triage:",
      "    runs-on: ubuntu-latest",
      "    permissions: write-all",
      "    steps:",
      "      - run: echo risky"
    ].join("\n")
  );
  await writeFile(
    path.join(root, ".github", "workflows", "implicit.yml"),
    [
      "name: Implicit",
      "on: pull_request",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: npm test"
    ].join("\n")
  );
  return root;
}

describe("scanWorkflows", () => {
  test("maps workflow triggers and job permissions", async () => {
    const root = await makeWorkspace();

    const result = await scanWorkflows({ root });
    const release = result.workflows.find((workflow) => workflow.name === "Release");

    expect(release?.triggers).toEqual(["push"]);
    expect(release?.permissions).toContainEqual({ scope: "contents", access: "read" });
    expect(release?.jobs.find((job) => job.id === "publish")?.permissions).toEqual([
      { scope: "contents", access: "write" },
      { scope: "packages", access: "write" }
    ]);
  });

  test("flags pull_request_target workflows with write-all permissions", async () => {
    const root = await makeWorkspace();

    const result = await scanWorkflows({ root });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: "pull-request-target-write",
        severity: "error",
        job: "triage"
      })
    );
  });

  test("flags workflows without explicit permissions", async () => {
    const root = await makeWorkspace();

    const result = await scanWorkflows({ root });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: "implicit-token-permissions",
        severity: "warning"
      })
    );
  });
});
