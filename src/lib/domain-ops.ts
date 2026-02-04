import { createSpaceshipClient } from "./spaceship"
import { createVercelClient } from "./vercel"
import { loadConfig } from "./config"

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
