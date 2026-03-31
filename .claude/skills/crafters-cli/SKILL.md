---
name: crafters-cli
description: Manage Crafter Station domains (Spaceship DNS + Vercel), agent infrastructure, and Claude Code configuration via the crafters CLI.
---

# Crafters CLI

Install: `npx skills add crafter-station/cs -g`

Agent-first CLI for managing Crafter Station infrastructure: domains, DNS, Vercel projects, Kai agents, and Claude Code configuration.

## Prerequisites

Check setup: `crafters whoami --json`. If it fails:

1. Install: `bun add -g crafter-station/cs`
2. Login: `crafters login --spaceshipKey=X --spaceshipSecret=X --vercelToken=X --domains=crafter.run,crafter.ing`
3. Sync skills: `crafters claude install`

## Discovery

Introspect all available commands and their arguments:
```bash
crafters schema --json
crafters schema domain.add --json
```

## Domain Management

### Add a subdomain (Vercel + DNS)
```bash
crafters domain add <subdomain> -p <vercel-project> --domain <base-domain> --json
```
Example:
```bash
crafters domain add legalize-pe -p legalize-pe-web --domain crafter.ing --json
```

### Preview before executing
```bash
crafters domain add <subdomain> -p <project> --domain crafter.ing --dry-run --json
```

### List all subdomains
```bash
crafters domain list --domain crafter.run --json
crafters domain list --domain crafter.ing --json
```

### Remove a subdomain
```bash
crafters domain remove <subdomain> -p <project> --domain crafter.run --json
```

### DNS-only (no Vercel)
```bash
crafters domain add <subdomain> -t <cname-target> --domain crafter.ing --json
```

### With Clerk secondary domain
```bash
crafters domain add <subdomain> -p <project> --clerk-key sk_live_xxx --domain crafter.run --json
```

## Agent Management
```bash
crafters agent list --json
crafters agent info <name> --json
crafters agent status --json
crafters agent doctor --json
crafters agent doctor --fix --json
```

## Configuration
```bash
crafters whoami --json
crafters login --spaceshipKey=X --spaceshipSecret=X --vercelToken=X --baseDomain=crafter.run --domains=crafter.run,crafter.ing
```

## MCP Server
Start as an MCP server over stdio:
```bash
crafters mcp
```

## Rules for AI Agents

1. ALWAYS use `--json` flag for structured output
2. ALWAYS use `--dry-run` before mutating operations, then confirm with the user
3. ALWAYS specify `--domain` when working with `crafter.ing` (default is `crafter.run`)
4. Subdomain must be lowercase alphanumeric with hyphens only
5. The CLI automatically uses the Vercel-recommended project-specific CNAME (not the generic `cname.vercel-dns.com`)
6. SSL certificates are issued automatically by Vercel after DNS propagation

## Available Domains

| Domain | Purpose |
|--------|---------|
| `crafter.run` | Primary domain for Crafter Station projects (default) |
| `crafter.ing` | Secondary domain for research and tools |

## Output Format

All `--json` responses follow:
```json
{"ok": true, "data": {...}}
{"ok": false, "error": {"code": "ERROR_CODE", "message": "..."}}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_SUBDOMAIN` | Bad subdomain format |
| `INVALID_PROJECT` | Bad project slug |
| `SPACESHIP_API_ERROR` | DNS API failure |
| `VERCEL_API_ERROR` | Vercel API failure |
| `AUTH_REQUIRED` | Missing credentials |
| `CONFIG_NOT_FOUND` | No config file |
