import { defineCommand } from "citty"
import pc from "picocolors"
import { basename } from "node:path"
import {
  resolveConfig,
  addDomain,
  addDomainDNSOnly,
  addDomainARecord,
  setupClerkDomain,
  removeDomain,
  removeDomainDNSOnly,
  listDomains,
  detectVercelProject,
} from "../lib/domain-ops"
import { globalArgs } from "../lib/common-args"
import { createOutput, outputError } from "../lib/output"

export const domainAdd = defineCommand({
  meta: {
    name: "add",
    description: "Add a subdomain to a Vercel project with Spaceship DNS",
  },
  args: {
    ...globalArgs,
    subdomain: {
      type: "positional",
      description: "Subdomain to add (e.g., 'myapp' for myapp.crafter.run)",
    },
    project: {
      type: "string",
      alias: "p",
      description: "Vercel project slug (auto-detected from .vercel/project.json)",
    },
    "no-vercel": {
      type: "boolean",
      description: "Skip Vercel, only create DNS record",
      default: false,
    },
    target: {
      type: "string",
      alias: "t",
      description: "Custom CNAME target (DNS-only, skips Vercel)",
    },
    ip: {
      type: "string",
      description: "IP address for A record (DNS-only, e.g., VPS)",
    },
    "clerk-key": {
      type: "string",
      description:
        "Clerk production secret key (sk_live_*). Registers subdomain as secondary application via BAPI and pipes 5 CNAMEs to DNS.",
    },
    "dry-run": {
      type: "boolean",
      description: "Preview changes without executing",
      default: false,
    },
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })

    try {
      const config = await resolveConfig({ domain: args.domain })
      const cwd = process.cwd()
      const subdomain = args.subdomain || basename(cwd)
      const fullDomain = `${subdomain}.${config.baseDomain}`

      if (args.target) {
        if (args["dry-run"]) {
          out.result({ dryRun: true, fullDomain, target: args.target, actions: ["spaceship:addCNAME"] })
          return
        }

        out.intro(pc.bgMagenta(pc.black(" domain add ")))
        out.info(`Domain: ${pc.cyan(fullDomain)}`)
        out.info(`Target: ${pc.cyan(args.target)}`)

        const s = out.spinner()
        s.start("Creating CNAME record")
        await addDomainDNSOnly(config, subdomain, args.target)
        s.stop(`CNAME: ${pc.dim(args.target)}`)

        out.result({ fullDomain, target: args.target })
        out.outro(`${pc.green(fullDomain)} -> ${pc.dim(args.target)}`)
        return
      }

      if (args.ip) {
        if (args["dry-run"]) {
          out.result({ dryRun: true, fullDomain, ip: args.ip, actions: ["spaceship:addA"] })
          return
        }

        out.intro(pc.bgMagenta(pc.black(" domain add ")))
        out.info(`Domain: ${pc.cyan(fullDomain)}`)
        out.info(`IP:     ${pc.cyan(args.ip)}`)

        const s = out.spinner()
        s.start("Creating A record")
        await addDomainARecord(config, subdomain, args.ip)
        s.stop(`A record: ${pc.dim(args.ip)}`)

        out.result({ fullDomain, ip: args.ip })
        out.outro(`${pc.green(fullDomain)} -> ${pc.dim(args.ip)} (A record)`)
        return
      }

      const skipVercel = args["no-vercel"]
      const project = args.project || detectVercelProject(cwd) || subdomain
      const clerkKey = args["clerk-key"] as string | undefined

      if (args["dry-run"]) {
        const actions: string[] = []
        if (!skipVercel) actions.push("vercel:addDomainToProject", "vercel:getRecommendedCNAME", "spaceship:addCNAME")
        else actions.push("spaceship:addCNAME")
        if (clerkKey) actions.push("clerk:registerSecondaryDomain", "spaceship:addClerkCNAMEs")

        out.result({
          dryRun: true,
          subdomain,
          fullDomain,
          baseDomain: config.baseDomain,
          project: skipVercel ? null : project,
          clerk: !!clerkKey,
          actions,
        })
        return
      }

      out.intro(pc.bgMagenta(pc.black(" domain add ")))
      out.info(`Domain: ${pc.cyan(fullDomain)}`)
      if (!skipVercel) {
        out.info(
          `Vercel: ${pc.cyan(project)} ${!args.project ? pc.dim("(auto-detected)") : ""}`
        )
      }
      if (clerkKey) {
        out.info(`Clerk:  ${pc.green("will register secondary application domain")}`)
      }

      let recommendedCNAME: string | undefined

      if (!skipVercel) {
        const s1 = out.spinner()
        s1.start("Adding domain to Vercel + Spaceship DNS")
        const result = await addDomain(config, subdomain, project)
        recommendedCNAME = result.recommendedCNAME
        s1.stop(`Vercel CNAME: ${pc.dim(result.recommendedCNAME)}`)
      }

      let clerkResult: { name: string; frontendApiUrl: string; cnameTargets: Array<{ host: string; value: string }> } | undefined

      if (clerkKey) {
        const s2 = out.spinner()
        s2.start("Registering Clerk secondary domain + 5 CNAMEs")
        try {
          clerkResult = await setupClerkDomain(config, fullDomain, clerkKey)
          s2.stop(`Clerk: ${pc.green(clerkResult.name)} (${clerkResult.cnameTargets.length} CNAMEs)`)
          out.info(`  Frontend API: ${pc.cyan(clerkResult.frontendApiUrl)}`)
          for (const cname of clerkResult.cnameTargets) {
            out.info(`  ${pc.dim(cname.host)} -> ${pc.dim(cname.value)}`)
          }
        } catch (err) {
          s2.stop(pc.yellow("Clerk registration failed"))
          out.warn(`${(err as Error).message}`)
        }
      }

      out.result({
        fullDomain,
        subdomain,
        baseDomain: config.baseDomain,
        project: skipVercel ? null : project,
        recommendedCNAME,
        clerk: clerkResult ? {
          name: clerkResult.name,
          frontendApiUrl: clerkResult.frontendApiUrl,
          cnameTargets: clerkResult.cnameTargets,
        } : undefined,
      })

      const parts = []
      if (!skipVercel) parts.push("Vercel")
      if (clerkKey) parts.push("Clerk")
      parts.push("DNS")

      out.outro(
        `${pc.green(fullDomain)} configured (${parts.join(" + ")}). SSL issued automatically.`
      )
    } catch (err) {
      outputError(!!args.json, "DOMAIN_ADD_FAILED", (err as Error).message)
      process.exit(1)
    }
  },
})

export const domainRemove = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a subdomain from DNS (and optionally Vercel)",
  },
  args: {
    ...globalArgs,
    subdomain: {
      type: "positional",
      description: "Subdomain to remove",
      required: true,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Vercel project slug (required for Vercel-managed domains)",
    },
    "dns-only": {
      type: "boolean",
      description: "Remove DNS record only (no Vercel). Required for A records.",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Preview changes without executing",
      default: false,
    },
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })

    try {
      const config = await resolveConfig({ domain: args.domain })
      const fullDomain = `${args.subdomain}.${config.baseDomain}`

      if (args["dry-run"]) {
        const actions = args["dns-only"] || !args.project
          ? ["spaceship:removeDNSRecord"]
          : ["vercel:removeDomainFromProject", "spaceship:removeCNAME"]
        out.result({ dryRun: true, fullDomain, subdomain: args.subdomain, project: args.project, actions })
        return
      }

      out.intro(pc.bgRed(pc.black(" domain remove ")))
      out.info(`Domain: ${pc.cyan(fullDomain)}`)

      if (args["dns-only"] || !args.project) {
        const s = out.spinner()
        s.start("Looking up DNS record")
        const { records } = await listDomains(config)
        const record = records.find((r) => r.name === args.subdomain)
        if (!record) {
          s.stop("Record not found")
          out.result({ fullDomain, removed: false, reason: "not_found" })
          out.outro(pc.yellow(`No DNS record found for ${args.subdomain}`))
          return
        }
        s.stop(`Found ${record.type} record`)

        const s2 = out.spinner()
        s2.start("Removing DNS record")
        await removeDomainDNSOnly(config, args.subdomain, record)
        s2.stop("DNS record removed")

        out.result({ fullDomain, subdomain: args.subdomain, removed: true, dnsOnly: true })
      } else {
        out.info(`Project: ${pc.cyan(args.project)}`)

        const s = out.spinner()
        s.start("Removing domain from Vercel and DNS")
        await removeDomain(config, args.subdomain, args.project)
        s.stop("Domain and DNS records removed")

        out.result({ fullDomain, subdomain: args.subdomain, project: args.project, removed: true })
      }

      out.outro(`${pc.yellow(fullDomain)} has been removed.`)
    } catch (err) {
      outputError(!!args.json, "DOMAIN_REMOVE_FAILED", (err as Error).message)
      process.exit(1)
    }
  },
})

export const domainList = defineCommand({
  meta: {
    name: "list",
    description: "List all configured subdomains",
  },
  args: {
    ...globalArgs,
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })

    try {
      const config = await resolveConfig({ domain: args.domain })

      const s = out.spinner()
      s.start("Fetching DNS records")
      const { records, baseDomain } = await listDomains(config)
      s.stop(`Found ${records.length} record(s)`)

      if (records.length === 0) {
        out.warn("No DNS records found.")
      } else {
        for (const record of records) {
          const target = record.cname || record.address || ""
          const typeTag = record.type === "A" ? pc.yellow("A") : pc.blue("CNAME")
          out.info(
            `${typeTag} ${pc.cyan(record.name + "." + baseDomain)} ${pc.dim("->")} ${pc.dim(target)}`
          )
        }
      }

      out.result({ records, baseDomain, total: records.length })
      out.outro(`${pc.dim(baseDomain)} - ${records.length} record(s)`)
    } catch (err) {
      outputError(!!args.json, "DOMAIN_LIST_FAILED", (err as Error).message)
      process.exit(1)
    }
  },
})

export const domain = defineCommand({
  meta: {
    name: "domain",
    description: "Manage domains for Vercel projects",
  },
  subCommands: {
    add: domainAdd,
    remove: domainRemove,
    list: domainList,
  },
})
