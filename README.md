<div align="center">

# GHA Permission Map

**Map GitHub Actions token permissions, triggers, and risky combinations.**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-permissions-blue)]()

[简体中文](README.zh-CN.md)

</div>

GitHub Actions workflows often grow by copy-paste. Months later, a repo has ten workflows and nobody can answer:

- which jobs have write-capable `GITHUB_TOKEN` permissions?
- which workflows still rely on implicit token defaults?
- where does `pull_request_target` run with a write token?
- which release jobs really need `contents: write` or `packages: write`?

`gha-permission-map` turns `.github/workflows` into a small local report.

No API keys. No GitHub calls. No telemetry.

## Documentation

| English | 简体中文 |
| --- | --- |
| [README](README.md) | [README.zh-CN](README.zh-CN.md) |
| [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md) |
| [Contributing](CONTRIBUTING.md) | [贡献指南](CONTRIBUTING.zh-CN.md) |
| [Security](SECURITY.md) | [安全说明](SECURITY.zh-CN.md) |

## 30 Second Demo

```bash
npx github:maxi-maxima/gha-permission-map demo
```

Example output:

```text
GHA Permission Map
Root: /path/to/reports/demo-workspace
Workflows: 2
Findings: 2

Review (.github/workflows/review.yml)
  triggers: pull_request_target
  workflow permissions: *:implicit
  job triage: *:write
```

The demo writes:

- `reports/demo/gha-permission-map.json`
- `reports/demo/gha-permission-map.md`

## Scan A Repo

```bash
npx github:maxi-maxima/gha-permission-map scan .
```

Useful variants:

```bash
# Write JSON and Markdown reports
npx github:maxi-maxima/gha-permission-map scan . --out reports/gha-permission-map

# Print machine-readable JSON
npx github:maxi-maxima/gha-permission-map scan . --json
```

## Findings

| Finding | Severity | Meaning |
| --- | --- | --- |
| `implicit-token-permissions` | warning | Workflow has no top-level `permissions`, so token scope depends on repository defaults. |
| `pull-request-target-write` | error | A `pull_request_target` job has write-capable token permissions. |
| `broad-write-token` | warning | Job grants `write-all` or wildcard write token permissions. |

## What It Parses

| Workflow Surface | Supported |
| --- | --- |
| Workflow files | `.github/workflows/*.yml`, `.github/workflows/*.yaml` |
| Triggers | string, list, and object forms of `on` |
| Permissions | `read-all`, `write-all`, `{}`, and per-scope maps |
| Job permissions | explicit job-level overrides and inherited workflow permissions |

## Why This Exists

GitHub's security guidance recommends least-privilege token permissions and extra caution with powerful triggers. The problem is visibility: reviewers usually see one workflow diff at a time, not the repo's whole permission map.

AI-generated workflows make this worse. They often work on the first run, but they can also copy broad `permissions: write-all` blocks into places that do not need them.

`gha-permission-map` gives maintainers a quick review artifact before debating whether a workflow is safe.

## How This Differs From Full Actions Scanners

Full scanners are valuable. `gha-permission-map` is deliberately narrower:

- no remote calls
- no policy engine
- no action pinning audit
- no secret scanning

It answers one question well: what token permissions does each workflow/job get, and which combinations deserve review?

## GitHub Action

```yaml
name: GHA Permission Map

on:
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Map GitHub Actions permissions
        run: npx github:maxi-maxima/gha-permission-map scan . --out reports/gha-permission-map
```

## Development

```bash
npm install
npm run check
node dist/cli.js demo
npm pack --dry-run --ignore-scripts
```

## Research Links

- [GitHub Actions workflow syntax: permissions](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions)
- [Use GITHUB_TOKEN for authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [Secure use reference for GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [Events that trigger workflows](https://docs.github.com/en/actions/reference/events-that-trigger-workflows)

## License

MIT
