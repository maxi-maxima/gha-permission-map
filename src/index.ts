import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export interface ScanOptions {
  root: string;
}

export interface PermissionScope {
  scope: string;
  access: "read" | "write" | "none" | "implicit";
}

export interface WorkflowJob {
  id: string;
  permissions: PermissionScope[];
  inherited: boolean;
}

export interface WorkflowSummary {
  file: string;
  name: string;
  triggers: string[];
  permissions: PermissionScope[];
  jobs: WorkflowJob[];
}

export interface Finding {
  id: string;
  severity: "info" | "warning" | "error";
  file: string;
  job?: string;
  message: string;
}

export interface ScanResult {
  root: string;
  workflows: WorkflowSummary[];
  findings: Finding[];
}

export interface ReportFiles {
  json: string;
  markdown: string;
}

type WorkflowDocument = Record<string, unknown>;

export async function scanWorkflows(options: ScanOptions): Promise<ScanResult> {
  const root = path.resolve(options.root);
  const workflowDir = path.join(root, ".github", "workflows");
  const files = await listWorkflowFiles(workflowDir);
  const workflows: WorkflowSummary[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const doc = parse(content) as WorkflowDocument | null;
    if (!doc || typeof doc !== "object") continue;
    workflows.push(toWorkflowSummary(root, file, doc));
  }

  return {
    root,
    workflows: workflows.sort((left, right) => left.file.localeCompare(right.file)),
    findings: makeFindings(workflows)
  };
}

export async function writeReports(result: ScanResult, outDir: string): Promise<ReportFiles> {
  const resolved = path.resolve(outDir);
  await mkdir(resolved, { recursive: true });
  const json = path.join(resolved, "gha-permission-map.json");
  const markdown = path.join(resolved, "gha-permission-map.md");
  await writeFile(json, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(markdown, renderMarkdown(result), "utf8");
  return { json, markdown };
}

export function renderText(result: ScanResult): string {
  const lines = [
    "GHA Permission Map",
    `Root: ${result.root}`,
    `Workflows: ${result.workflows.length}`,
    `Findings: ${result.findings.length}`,
    ""
  ];

  for (const workflow of result.workflows) {
    lines.push(`${workflow.name} (${workflow.file})`);
    lines.push(`  triggers: ${workflow.triggers.join(", ") || "unknown"}`);
    lines.push(`  workflow permissions: ${formatPermissions(workflow.permissions)}`);
    for (const job of workflow.jobs) {
      lines.push(`  job ${job.id}: ${formatPermissions(job.permissions)}${job.inherited ? " (inherited)" : ""}`);
    }
  }

  if (result.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of result.findings) {
      lines.push(`  - [${finding.severity}] ${finding.file}${finding.job ? `#${finding.job}` : ""}: ${finding.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderMarkdown(result: ScanResult): string {
  const workflowRows = result.workflows
    .map((workflow) => {
      const jobs = workflow.jobs
        .map((job) => `${job.id}: ${formatPermissions(job.permissions)}${job.inherited ? " (inherited)" : ""}`)
        .join("<br>");
      return `| \`${workflow.file}\` | ${workflow.name} | ${workflow.triggers.join(", ")} | ${formatPermissions(
        workflow.permissions
      )} | ${jobs} |`;
    })
    .join("\n");
  const findingRows = result.findings
    .map(
      (finding) =>
        `| ${finding.severity} | \`${finding.file}\` | ${finding.job ?? ""} | ${finding.id} | ${finding.message} |`
    )
    .join("\n");

  return `# GHA Permission Map Report

| Field | Value |
| --- | --- |
| Root | \`${result.root}\` |
| Workflows | ${result.workflows.length} |
| Findings | ${result.findings.length} |

## Workflows

| File | Name | Triggers | Workflow Permissions | Jobs |
| --- | --- | --- | --- | --- |
${workflowRows || "| - | - | - | - | - |"}

## Findings

| Severity | File | Job | Rule | Message |
| --- | --- | --- | --- | --- |
${findingRows || "| - | - | - | - | - |"}
`;
}

function toWorkflowSummary(root: string, file: string, doc: WorkflowDocument): WorkflowSummary {
  const relative = slash(path.relative(root, file));
  const workflowPermissions = normalizePermissions(doc.permissions);
  const jobs = parseJobs(doc.jobs, workflowPermissions);
  return {
    file: relative,
    name: typeof doc.name === "string" ? doc.name : path.basename(file),
    triggers: parseTriggers(doc.on),
    permissions: workflowPermissions,
    jobs
  };
}

function parseJobs(jobs: unknown, inheritedPermissions: PermissionScope[]): WorkflowJob[] {
  if (!isRecord(jobs)) return [];
  return Object.entries(jobs).map(([id, value]) => {
    const job = isRecord(value) ? value : {};
    const hasOwnPermissions = Object.prototype.hasOwnProperty.call(job, "permissions");
    return {
      id,
      permissions: hasOwnPermissions ? normalizePermissions(job.permissions) : inheritedPermissions,
      inherited: !hasOwnPermissions
    };
  });
}

function parseTriggers(onValue: unknown): string[] {
  if (typeof onValue === "string") return [onValue];
  if (Array.isArray(onValue)) return onValue.filter((value): value is string => typeof value === "string").sort();
  if (isRecord(onValue)) return Object.keys(onValue).sort();
  return [];
}

function normalizePermissions(value: unknown): PermissionScope[] {
  if (value === undefined || value === null) return [{ scope: "*", access: "implicit" }];
  if (typeof value === "string") {
    if (value === "read-all") return [{ scope: "*", access: "read" }];
    if (value === "write-all") return [{ scope: "*", access: "write" }];
    if (value === "{}") return [{ scope: "*", access: "none" }];
    return [{ scope: "*", access: "implicit" }];
  }
  if (!isRecord(value)) return [{ scope: "*", access: "implicit" }];
  const entries = Object.entries(value)
    .map(([scope, access]) => ({
      scope,
      access: normalizeAccess(access)
    }))
    .sort((left, right) => left.scope.localeCompare(right.scope));
  return entries.length > 0 ? entries : [{ scope: "*", access: "none" }];
}

function normalizeAccess(value: unknown): PermissionScope["access"] {
  if (value === "read" || value === "write" || value === "none") return value;
  return "implicit";
}

function makeFindings(workflows: WorkflowSummary[]): Finding[] {
  const findings: Finding[] = [];
  for (const workflow of workflows) {
    if (hasImplicitWorkflowPermissions(workflow)) {
      findings.push({
        id: "implicit-token-permissions",
        severity: "warning",
        file: workflow.file,
        message: "Workflow does not declare top-level GITHUB_TOKEN permissions."
      });
    }
    for (const job of workflow.jobs) {
      if (workflow.triggers.includes("pull_request_target") && hasWritePermission(job.permissions)) {
        findings.push({
          id: "pull-request-target-write",
          severity: "error",
          file: workflow.file,
          job: job.id,
          message: "pull_request_target job has write-capable token permissions."
        });
      }
      if (hasBroadWrite(job.permissions)) {
        findings.push({
          id: "broad-write-token",
          severity: "warning",
          file: workflow.file,
          job: job.id,
          message: "Job grants write-all or broad wildcard token permissions."
        });
      }
    }
  }
  return findings.sort((left, right) => left.file.localeCompare(right.file) || (left.job ?? "").localeCompare(right.job ?? ""));
}

function hasImplicitWorkflowPermissions(workflow: WorkflowSummary): boolean {
  return workflow.permissions.some((permission) => permission.scope === "*" && permission.access === "implicit");
}

function hasWritePermission(permissions: PermissionScope[]): boolean {
  return permissions.some((permission) => permission.access === "write");
}

function hasBroadWrite(permissions: PermissionScope[]): boolean {
  return permissions.some((permission) => permission.scope === "*" && permission.access === "write");
}

async function listWorkflowFiles(workflowDir: string): Promise<string[]> {
  if (!(await pathExists(workflowDir))) return [];
  const dirStat = await stat(workflowDir);
  if (!dirStat.isDirectory()) return [];
  const entries = await readdir(workflowDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(ya?ml)$/i.test(entry.name))
    .map((entry) => path.join(workflowDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPermissions(permissions: PermissionScope[]): string {
  return permissions.map((permission) => `${permission.scope}:${permission.access}`).join(", ");
}

function slash(value: string): string {
  return value.split(path.sep).join("/");
}
