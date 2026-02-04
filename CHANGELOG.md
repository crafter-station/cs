# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-04

### Added

- **Interactive TUI** — run `crafters` with no args to launch a full-screen terminal UI
  - Home screen with navigation menu
  - Domains screen: list, add, and remove CNAME records
  - Add-domain flow fetches Vercel projects for selection (no need to look up slugs)
  - Success screen shows clickable domain URLs with SSL provisioning note
  - Claude Config screen: install/update claude-dx
  - Credentials screen: login/logout with masked token display
  - Dialog overlays, toast notifications, keyboard navigation throughout

### Changed

- CLI commands now use `@clack/prompts` for polished output (spinners, colors)
- Extracted business logic into `domain-ops.ts` and `claude-ops.ts` for reuse

### Fixed

- `listProjectDomains` used non-existent `getProject` method (now uses `getProjectDomains`)

## [0.2.2] - 2026-01-11

### Added

- Skills installation support - copies skills from `claude-dx` to `~/.claude/skills/`
- Includes `skill-creator` skill from `anthropics/skills`

## [0.2.1] - 2025-01-10

### Fixed

- Clone claude-dx to `~/.crafters/claude-dx` instead of hardcoded user path

## [0.2.0] - 2025-01-10

### Added

- **Claude Code Integration**
  - `crafters claude install` - Install commands and agents from claude-dx repo
  - `crafters claude update` - Update all commands and agents (overwrites existing)

- **Features**
  - Clones/updates `crafter-station/claude-dx` to local machine
  - Copies commands to `~/.claude/commands/`
  - Copies agents to `~/.claude/agents/`
  - Intelligent merge of `settings.json` (preserves existing config, adds new permissions)
  - Skip existing commands by default, use `--force` or `update` to overwrite

## [0.1.0] - 2024-12-20

### Added

- **CLI Commands**
  - `crafters domain add <subdomain> -p <project>` - Add subdomain to Vercel project
  - `crafters domain remove <subdomain> -p <project>` - Remove subdomain from Vercel project
  - `crafters domain list` - List all CNAME records
  - `crafters login` - Configure credentials
  - `crafters logout` - Remove stored credentials
  - `crafters whoami` - Show current configuration

- **Features**
  - Automatic CNAME creation in Spaceship DNS
  - Uses Vercel's recommended CNAME (project-specific) instead of generic `cname.vercel-dns.com`
  - Credentials stored securely in `~/.crafters/config.json`
  - Support for environment variables as fallback

### Dependencies

- `@vercel/sdk` - Vercel API integration
- `citty` - Lightweight CLI framework
