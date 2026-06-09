<div align="center">

# GHA Permission Map

**映射 GitHub Actions 的 token 权限、触发器和高风险组合。**

[English](README.md)

</div>

GitHub Actions workflow 经常靠复制粘贴增长。几个月后，一个仓库里有十几个 workflow，却没人能快速回答：

- 哪些 job 拿到了可写的 `GITHUB_TOKEN` 权限？
- 哪些 workflow 还在依赖隐式 token 默认值？
- 哪些 `pull_request_target` 会带着写权限运行？
- 哪些 release job 真的需要 `contents: write` 或 `packages: write`？

`gha-permission-map` 把 `.github/workflows` 转成一个本地可读报告。

不需要 API key。不调用 GitHub API。没有遥测。

## 文档

| English | 简体中文 |
| --- | --- |
| [README](README.md) | [README.zh-CN](README.zh-CN.md) |
| [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md) |
| [Contributing](CONTRIBUTING.md) | [贡献指南](CONTRIBUTING.zh-CN.md) |
| [Security](SECURITY.md) | [安全说明](SECURITY.zh-CN.md) |

## 30 秒演示

```bash
npx github:maxi-maxima/gha-permission-map demo
```

示例输出：

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

演示会写入：

- `reports/demo/gha-permission-map.json`
- `reports/demo/gha-permission-map.md`

## 扫描仓库

```bash
npx github:maxi-maxima/gha-permission-map scan .
```

常用变体：

```bash
# 写入 JSON 和 Markdown 报告
npx github:maxi-maxima/gha-permission-map scan . --out reports/gha-permission-map

# 输出机器可读 JSON
npx github:maxi-maxima/gha-permission-map scan . --json
```

## 发现项

| 发现项 | 严重度 | 含义 |
| --- | --- | --- |
| `implicit-token-permissions` | warning | workflow 没有顶层 `permissions`，token 范围取决于仓库默认值。 |
| `pull-request-target-write` | error | `pull_request_target` job 拿到了可写 token 权限。 |
| `broad-write-token` | warning | job 授予了 `write-all` 或通配写权限。 |

## 解析范围

| Workflow 使用面 | 支持情况 |
| --- | --- |
| Workflow 文件 | `.github/workflows/*.yml`, `.github/workflows/*.yaml` |
| 触发器 | `on` 的字符串、列表和对象形式 |
| 权限 | `read-all`, `write-all`, `{}` 和逐 scope 映射 |
| Job 权限 | 显式 job 权限覆盖，以及继承 workflow 权限 |

## 为什么做这个

GitHub 的安全建议强调最小权限 token，并提醒谨慎使用强触发器。问题在于可见性：评审者通常只看到单个 workflow diff，而不是整个仓库的权限地图。

AI 生成 workflow 会放大这个问题。它们往往第一次就能跑通，但也可能把宽泛的 `permissions: write-all` 复制到不需要的地方。

`gha-permission-map` 给维护者一个快速审查产物，让讨论从“感觉安全吗”变成“这个 job 到底拿了什么权限”。

## 与完整 Actions 扫描器的区别

完整扫描器很有价值。`gha-permission-map` 故意更窄：

- 不做远程调用
- 不做策略引擎
- 不审计 action pinning
- 不做 secret 扫描

它专注回答一个问题：每个 workflow/job 拿到了哪些 token 权限，哪些组合值得审查？

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

## 开发

```bash
npm install
npm run check
node dist/cli.js demo
npm pack --dry-run --ignore-scripts
```

## 调研链接

- [GitHub Actions workflow syntax: permissions](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions)
- [Use GITHUB_TOKEN for authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [Secure use reference for GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [Events that trigger workflows](https://docs.github.com/en/actions/reference/events-that-trigger-workflows)

## 许可证

MIT
