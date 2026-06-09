# Security

`gha-permission-map` reads local workflow files and reports token permission declarations. It does not call GitHub, execute workflow steps, or read secrets.

## Reporting

Please report security issues through a private GitHub advisory when available, or contact the maintainer directly.

## Scope

Security-relevant issues include:

- executing workflow content
- reading files outside the requested repository root
- sending workflow content over the network
- reporting misleading permission results for supported syntax

Unsupported YAML edge cases are normal bugs unless they create materially misleading security output.
