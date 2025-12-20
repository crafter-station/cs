# crafters

CLI for managing domains on Vercel projects with Spaceship DNS.

## Install

```bash
bun install -g crafters
```

## Setup

```bash
crafters login \
  --spaceshipKey="YOUR_KEY" \
  --spaceshipSecret="YOUR_SECRET" \
  --vercelToken="YOUR_TOKEN" \
  --vercelTeamId="YOUR_TEAM_ID"
```

## Usage

```bash
# Add subdomain to project
crafters domain add myapp -p my-vercel-project

# Remove subdomain
crafters domain remove myapp -p my-vercel-project

# List all CNAME records
crafters domain list

# Check current config
crafters whoami
```

## License

MIT
