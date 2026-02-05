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

export function detectClerk(cwd = process.cwd()): boolean {
  // Check package.json for @clerk/*
  const pkgPath = join(cwd, "package.json")
  if (existsSync(pkgPath)) {
    try {
      const pkg = readFileSync(pkgPath, "utf-8")
      if (pkg.includes('"@clerk/')) return true
    } catch {}
  }

  // Check .env.local for CLERK_SECRET_KEY
  const envPath = join(cwd, ".env.local")
  if (existsSync(envPath)) {
    try {
      const env = readFileSync(envPath, "utf-8")
      if (env.includes("CLERK_SECRET_KEY=")) return true
    } catch {}
  }

  return false
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

export async function addClerkDomain(
  config: ResolvedConfig,
  fullDomain: string
): Promise<{ cnameTargets: Array<{ host: string; value: string }> }> {
  const { execSync } = await import("node:child_process")

  const output = execSync(
    `clerk domains add --name ${fullDomain} --dotenv -o json`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  )
  const data = JSON.parse(output)
  const cnameTargets: Array<{ host: string; value: string }> = data.cname_targets ?? []

  if (cnameTargets.length > 0) {
    const spaceship = createSpaceshipClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseDomain: config.baseDomain,
    })

    for (const cname of cnameTargets) {
      const sub = cname.host.replace(`.${config.baseDomain}`, "")
      await spaceship.addCNAME(sub, cname.value)
    }
  }

  return { cnameTargets }
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
