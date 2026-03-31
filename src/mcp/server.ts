import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  resolveConfig,
  addDomain,
  addDomainDNSOnly,
  removeDomain,
  listDomains,
  listProjects,
} from "../lib/domain-ops"
import { loadConfig } from "../lib/config"
import { validateSubdomain, validateProjectSlug } from "../lib/validate"
import { getCommandSchemas } from "../lib/command-registry"

export async function startMcpServer() {
  const server = new McpServer({
    name: "crafters",
    version: "0.4.0",
  })

  server.tool(
    "domain_add",
    "Add a subdomain to a Vercel project with Spaceship DNS + recommended CNAME",
    {
      subdomain: z.string().describe("Subdomain name (e.g., 'myapp')"),
      project: z.string().describe("Vercel project slug"),
      domain: z.string().optional().describe("Base domain (e.g., crafter.ing). Default: from config"),
      dryRun: z.boolean().optional().describe("Preview changes without executing"),
    },
    async ({ subdomain, project, domain, dryRun }) => {
      const subValidation = validateSubdomain(subdomain)
      if (!subValidation.valid) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: { code: "INVALID_SUBDOMAIN", message: subValidation.error } }) }] }
      }

      const projValidation = validateProjectSlug(project)
      if (!projValidation.valid) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: { code: "INVALID_PROJECT", message: projValidation.error } }) }] }
      }

      const config = await resolveConfig({ domain })
      const fullDomain = `${subValidation.normalized}.${config.baseDomain}`

      if (dryRun) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ok: true,
              data: {
                dryRun: true,
                subdomain: subValidation.normalized,
                fullDomain,
                baseDomain: config.baseDomain,
                project: projValidation.normalized,
                actions: ["vercel:addDomainToProject", "vercel:getRecommendedCNAME", "spaceship:addCNAME"],
              },
            }),
          }],
        }
      }

      const result = await addDomain(config, subValidation.normalized!, projValidation.normalized!)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            data: {
              fullDomain: result.fullDomain,
              recommendedCNAME: result.recommendedCNAME,
            },
          }),
        }],
      }
    }
  )

  server.tool(
    "domain_add_dns_only",
    "Add a DNS CNAME record without Vercel (for external services)",
    {
      subdomain: z.string().describe("Subdomain name"),
      target: z.string().describe("CNAME target"),
      domain: z.string().optional().describe("Base domain override"),
    },
    async ({ subdomain, target, domain }) => {
      const subValidation = validateSubdomain(subdomain)
      if (!subValidation.valid) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: subValidation.error }) }] }
      }

      const config = await resolveConfig({ domain })
      const result = await addDomainDNSOnly(config, subValidation.normalized!, target)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data: result }),
        }],
      }
    }
  )

  server.tool(
    "domain_remove",
    "Remove a subdomain from Vercel project and DNS",
    {
      subdomain: z.string().describe("Subdomain to remove"),
      project: z.string().describe("Vercel project slug"),
      domain: z.string().optional().describe("Base domain override"),
    },
    async ({ subdomain, project, domain }) => {
      const config = await resolveConfig({ domain })
      const result = await removeDomain(config, subdomain, project)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data: result }),
        }],
      }
    }
  )

  server.tool(
    "domain_list",
    "List all CNAME records for a domain",
    {
      domain: z.string().optional().describe("Base domain (e.g., crafter.ing). Default: from config"),
    },
    async ({ domain }) => {
      const config = await resolveConfig({ domain })
      const result = await listDomains(config)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data: result }),
        }],
      }
    }
  )

  server.tool(
    "projects_list",
    "List Vercel projects (optionally filter by search term)",
    {
      search: z.string().optional().describe("Search filter for project names"),
      domain: z.string().optional().describe("Base domain override"),
    },
    async ({ search, domain }) => {
      const config = await resolveConfig({ domain })
      const projects = await listProjects(config, search)
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data: { projects, total: projects.length } }),
        }],
      }
    }
  )

  server.tool(
    "schema_inspect",
    "Introspect available CLI commands and their arguments",
    {
      command: z.string().optional().describe("Command path (e.g., domain.add). Omit for all."),
    },
    async ({ command }) => {
      const schemas = getCommandSchemas()
      const data = command
        ? schemas.find((s) => s.name === command) || null
        : schemas

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, data }),
        }],
      }
    }
  )

  server.tool(
    "config_whoami",
    "Show current Crafters CLI configuration (masked credentials)",
    {},
    async () => {
      const config = await loadConfig()
      if (!config) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ok: false, error: { code: "NOT_CONFIGURED", message: "Not logged in" } }),
          }],
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            data: {
              baseDomain: config.baseDomain,
              domains: config.domains,
              spaceship: { apiKey: config.spaceship.apiKey.slice(0, 8) + "..." },
              vercel: { token: config.vercel.token.slice(0, 8) + "...", teamId: config.vercel.teamId },
            },
          }),
        }],
      }
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
