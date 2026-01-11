# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the CLI in development
bun run src/index.ts

# Build standalone executable
bun build src/index.ts --compile --outfile crafters

# Run with specific command
bun run src/index.ts claude install
bun run src/index.ts claude update
bun run src/index.ts domain add myapp -p my-vercel-project
bun run src/index.ts login --spaceshipKey="..." --spaceshipSecret="..." --vercelToken="..."
```

## Architecture

This is a CLI tool (`crafters`) for managing domains on Vercel projects with Spaceship DNS. Built with Bun and the `citty` CLI framework.

### Structure

- `src/index.ts` - Entry point, defines main command and subcommands using citty's `defineCommand`
- `src/commands/` - Command implementations
  - `claude.ts` - `claude install/update` for syncing Claude Code config from claude-dx
  - `domain.ts` - `domain add/remove/list` commands (core functionality)
  - `login.ts` - `login/logout/whoami` credential management
- `src/lib/` - API clients and utilities
  - `spaceship.ts` - Spaceship DNS API client (CNAME management)
  - `vercel.ts` - Vercel SDK wrapper for project domain operations
  - `config.ts` - Config file management (`~/.crafters/config.json`)

### Key Patterns

- Commands use citty's `defineCommand` with `meta`, `args`, and `run` properties
- API clients are factory functions (`createSpaceshipClient`, `createVercelClient`) returning method objects
- Configuration supports both file-based (`~/.crafters/config.json`) and environment variable fallbacks
- Domain operations coordinate both Vercel (add domain to project) and Spaceship (create CNAME record)
