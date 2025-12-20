# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
