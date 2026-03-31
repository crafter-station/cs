# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run src/index.ts                              # show help
bun run src/index.ts domain add myapp -p proj     # human output
bun run src/index.ts domain add myapp -p proj --json --domain crafter.ing  # agent output
bun run src/index.ts domain add myapp -p proj --dry-run --json             # preview
bun run src/index.ts schema domain.add --json     # introspect command
bun run src/index.ts schema --json                # list all commands
bun run src/index.ts mcp                          # start MCP server
bun run src/index.ts tui                          # interactive TUI
```

## Architecture

Agent-first CLI (`crafters`) for managing Crafter Station infrastructure. Built with Bun + `citty` framework.

### Structure

```
src/
├── index.ts              # Entry point, subcommand routing
├── commands/
│   ├── domain.ts         # domain add/remove/list (--json, --domain, --dry-run)
│   ├── agent.ts          # agent list/info/setup/status/doctor
│   ├── claude.ts         # claude install/update (syncs claude-dx + local skills)
│   ├── projects.ts       # projects sync (GitHub metadata)
│   ├── login.ts          # login/logout/whoami
│   └── schema.ts         # schema introspection for agents
├── lib/
│   ├── output.ts         # Dual output: human (clack) vs JSON (structured)
│   ├── common-args.ts    # Shared --json and --domain flags
│   ├── validate.ts       # Input hardening (subdomain, domain, project slug)
│   ├── errors.ts         # Typed error codes + CraftersError class
│   ├── command-registry.ts # Command tree for schema introspection
│   ├── config.ts         # Config file (~/.crafters/config.json)
│   ├── spaceship.ts      # Spaceship DNS API client
│   ├── vercel.ts         # Vercel SDK wrapper
│   ├── domain-ops.ts     # Domain orchestration (Vercel + DNS + Clerk)
│   ├── claude-ops.ts     # Claude DX sync (commands, agents, skills)
│   └── agent-ops.ts      # Kai executor management
├── mcp/
│   └── server.ts         # MCP server over stdio
├── tui/                  # Interactive TUI (OpenTUI/Solid.js, secondary)
└── ui/                   # Shared colors
```

### Key Patterns

- All commands support `--json` for structured output: `{ ok: boolean, data: T, error?: { code, message } }`
- `--domain` flag overrides base domain (crafter.run vs crafter.ing)
- `--dry-run` on mutating commands previews actions without executing
- `createOutput({ json })` auto-detects TTY for output mode
- API clients are factory functions (`createSpaceshipClient`, `createVercelClient`)
- MCP server calls `src/lib/` directly (no shell-out)
- `crafters schema` introspects the command tree for agent consumption
- Skills auto-install from `.claude/skills/` during `crafters claude install`

### Multi-Domain

Both `crafter.run` and `crafter.ing` share the same Spaceship creds and Vercel team.
The `--domain` flag only changes which DNS zone the Spaceship API operates on.
