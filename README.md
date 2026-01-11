# crafters

Crafter Station CLI for domain management and Claude Code configuration.

## Install

```bash
bun install -g crafters
```

## Commands

### Claude Code

Sync Claude Code commands and agents from `crafter-station/claude-dx`.

```bash
# First-time install (skips existing commands)
crafters claude install

# Update all commands (overwrites existing)
crafters claude update

# Force overwrite on install
crafters claude install --force
```

**What it does:**
- Clones/pulls `claude-dx` to `~/Programming/crafter-station/`
- Copies commands to `~/.claude/commands/`
- Copies agents to `~/.claude/agents/`
- Merges `settings.json` without overwriting existing config

### Domain Management

Manage Vercel project domains with Spaceship DNS.

```bash
# Setup credentials
crafters login \
  --spaceshipKey="YOUR_KEY" \
  --spaceshipSecret="YOUR_SECRET" \
  --vercelToken="YOUR_TOKEN" \
  --vercelTeamId="YOUR_TEAM_ID"

# Add subdomain to project
crafters domain add myapp -p my-vercel-project

# Remove subdomain
crafters domain remove myapp -p my-vercel-project

# List all CNAME records
crafters domain list

# Check current config
crafters whoami

# Clear credentials
crafters logout
```

## Requirements

- [Bun](https://bun.sh)
- [GitHub CLI](https://cli.github.com) (for claude commands)
- Access to `crafter-station/claude-dx` repo

## License

MIT
