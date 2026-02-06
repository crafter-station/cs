import { createSpaceshipClient } from "./spaceship"
import { createVercelClient } from "./vercel"
import { loadConfig } from "./config"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface ResolvedConfig {
  apiKey: string
  apiSecret: string
  baseDomain: string
  vercelToken: string
  vercelTeamId?: string
}

export async function resolveConfig(): Promise<ResolvedConfig> {
  const fileConfig = await loadConfig()

  const apiKey = process.env.SPACESHIP_API_KEY || fileConfig?.spaceship.apiKey
  const apiSecret =
    process.env.SPACESHIP_API_SECRET || fileConfig?.spaceship.apiSecret
  const baseDomain =
    process.env.BASE_DOMAIN || fileConfig?.baseDomain || "crafter.run"
  const vercelToken = process.env.VERCEL_TOKEN || fileConfig?.vercel.token
  const vercelTeamId = process.env.VERCEL_TEAM_ID || fileConfig?.vercel.teamId

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing credentials. Run `crafters login` or set SPACESHIP_API_KEY/SPACESHIP_API_SECRET"
    )
  }
  if (!vercelToken) {
    throw new Error(
      "Missing Vercel token. Run `crafters login` or set VERCEL_TOKEN"
    )
  }

  return { apiKey, apiSecret, baseDomain, vercelToken, vercelTeamId }
}

// --- Detection helpers ---

export function detectVercelProject(cwd = process.cwd()): string | null {
  // Try .vercel/project.json first
  const vercelProjectPath = join(cwd, ".vercel", "project.json")
  if (existsSync(vercelProjectPath)) {
    try {
      const data = JSON.parse(readFileSync(vercelProjectPath, "utf-8"))
      if (data.projectId) {
        return data.projectId
      }
    } catch {}
  }

  // Fallback: infer from directory name
  return null
}

export function detectProjectName(cwd = process.cwd()): string | null {
  const pkgPath = join(cwd, "package.json")
  if (existsSync(pkgPath)) {
    try {
      const data = JSON.parse(readFileSync(pkgPath, "utf-8"))
      if (data.name) return data.name
    } catch {}
  }
  return null
}

// --- Domain operations ---

export async function addDomain(
  config: ResolvedConfig,
  subdomain: string,
  project: string
): Promise<{ fullDomain: string; recommendedCNAME: string }> {
  const fullDomain = `${subdomain}.${config.baseDomain}`

  const spaceship = createSpaceshipClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    baseDomain: config.baseDomain,
  })

  const vercel = createVercelClient({
    token: config.vercelToken,
    teamId: config.vercelTeamId,
  })

  await vercel.addDomainToProject(project, fullDomain)
  const recommendedCNAME = await vercel.getRecommendedCNAME(fullDomain)
  await spaceship.addCNAME(subdomain, recommendedCNAME)

  return { fullDomain, recommendedCNAME }
}

export interface ClerkDomainResult {
  name: string
  frontendApiUrl: string
  cnameTargets: Array<{ host: string; value: string }>
}

/**
 * Register a secondary application domain on a Clerk production instance
 * and pipe the 5 CNAMEs to Spaceship DNS.
 *
 * Uses `POST /v1/instance/change_domain` with `is_secondary: true`.
 * This is NOT satellite (premium) - it uses suffixed cookies so multiple
 * Clerk apps can share the same root domain (e.g. a.crafter.run + b.crafter.run).
 */
export async function setupClerkDomain(
  config: ResolvedConfig,
  fullDomain: string,
  clerkSecretKey: string
): Promise<ClerkDomainResult> {
  const baseUrl = "https://api.clerk.com/v1"
  const headers = {
    Authorization: `Bearer ${clerkSecretKey}`,
    "Content-Type": "application/json",
  }

  // Step 1: Change primary domain to our subdomain as secondary
  const changeRes = await fetch(`${baseUrl}/instance/change_domain`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      home_url: `https://${fullDomain}`,
      is_secondary: true,
    }),
  })
  if (!changeRes.ok) {
    const err = await changeRes.json()
    throw new Error(
      err.errors?.[0]?.long_message ?? `Failed to change domain: ${changeRes.status}`
    )
  }

  // Step 2: Read the domain to get CNAME targets
  const domainsRes = await fetch(`${baseUrl}/domains`, { headers })
  if (!domainsRes.ok) {
    throw new Error(`Failed to read domains: ${domainsRes.status}`)
  }
  const domainsData = (await domainsRes.json()) as {
    data: Array<{
      name: string
      frontend_api_url: string
      cname_targets: Array<{ host: string; value: string }>
    }>
  }

  const domain = domainsData.data.find((d) => d.name === fullDomain)
  if (!domain) {
    throw new Error(`Domain ${fullDomain} not found after change_domain`)
  }

  // Step 3: Pipe all CNAMEs to Spaceship DNS
  const spaceship = createSpaceshipClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    baseDomain: config.baseDomain,
  })

  for (const cname of domain.cname_targets) {
    const sub = cname.host.replace(`.${config.baseDomain}`, "")
    await spaceship.addCNAME(sub, cname.value)
  }

  return {
    name: domain.name,
    frontendApiUrl: domain.frontend_api_url,
    cnameTargets: domain.cname_targets,
  }
}

export async function addDomainDNSOnly(
  config: ResolvedConfig,
  subdomain: string,
  target: string
): Promise<{ fullDomain: string; target: string }> {
  const fullDomain = `${subdomain}.${config.baseDomain}`

  const spaceship = createSpaceshipClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    baseDomain: config.baseDomain,
  })

  await spaceship.addCNAME(subdomain, target)

  return { fullDomain, target }
}

export async function removeDomain(
  config: ResolvedConfig,
  subdomain: string,
  project: string
): Promise<{ fullDomain: string }> {
  const fullDomain = `${subdomain}.${config.baseDomain}`

  const spaceship = createSpaceshipClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    baseDomain: config.baseDomain,
  })

  const vercel = createVercelClient({
    token: config.vercelToken,
    teamId: config.vercelTeamId,
  })

  await vercel.removeDomainFromProject(project, fullDomain)
  await spaceship.removeCNAME(subdomain)

  return { fullDomain }
}

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  updatedAt: number | null
}

export async function listProjects(
  config: ResolvedConfig,
  search?: string
): Promise<VercelProject[]> {
  const vercel = createVercelClient({
    token: config.vercelToken,
    teamId: config.vercelTeamId,
  })

  return vercel.listProjects(search)
}

export async function listDomains(
  config: ResolvedConfig
): Promise<{
  records: Array<{ type: string; name: string; cname?: string; ttl: number }>
  baseDomain: string
}> {
  const spaceship = createSpaceshipClient({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    baseDomain: config.baseDomain,
  })

  const result = await spaceship.listRecords()
  const records = result.items.filter((r) => r.type === "CNAME")

  return { records, baseDomain: config.baseDomain }
}
