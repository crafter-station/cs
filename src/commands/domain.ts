import { defineCommand } from "citty"
import * as p from "@clack/prompts"
import pc from "picocolors"
import { basename } from "node:path"
import {
  resolveConfig,
  addDomain,
  setupClerkDomain,
  removeDomain,
  listDomains,
  detectVercelProject,
} from "../lib/domain-ops"

export const domainAdd = defineCommand({
  meta: {
    name: "add",
    description: "Add a subdomain to a Vercel project with Spaceship DNS",
  },
  args: {
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
    "clerk-key": {
      type: "string",
      description:
        "Clerk production secret key (sk_live_*). Registers subdomain as secondary application via BAPI and pipes 5 CNAMEs to DNS.",
    },
  },
  async run({ args }) {
    p.intro(pc.bgMagenta(pc.black(" domain add ")))

    const config = await resolveConfig()
    const cwd = process.cwd()

    // --- Resolve subdomain ---
    const subdomain = args.subdomain || basename(cwd)
    const fullDomain = `${subdomain}.${config.baseDomain}`

    // --- Custom target mode: just DNS ---
    if (args.target) {
      p.log.info(`Domain: ${pc.cyan(fullDomain)}`)
      p.log.info(`Target: ${pc.cyan(args.target)}`)

      const s = p.spinner()
      s.start("Creating CNAME record")
      const { addDomainDNSOnly } = await import("../lib/domain-ops")
      await addDomainDNSOnly(config, subdomain, args.target)
      s.stop(`CNAME: ${pc.dim(args.target)}`)

      p.outro(`${pc.green(fullDomain)} -> ${pc.dim(args.target)}`)
      return
    }

    // --- Auto-detect project ---
    const skipVercel = args["no-vercel"]
    const project = args.project || detectVercelProject(cwd) || subdomain
    const clerkKey = args["clerk-key"] as string | undefined

    // --- Show what we detected ---
    p.log.info(`Domain: ${pc.cyan(fullDomain)}`)
    if (!skipVercel) {
      p.log.info(
        `Vercel: ${pc.cyan(project)} ${!args.project ? pc.dim("(auto-detected)") : ""}`
      )
    }
    if (clerkKey) {
      p.log.info(`Clerk:  ${pc.green("will register secondary application domain")}`)
    }

    // --- Step 1: Vercel + DNS ---
    if (!skipVercel) {
      const s1 = p.spinner()
      s1.start("Adding domain to Vercel + Spaceship DNS")
      const result = await addDomain(config, subdomain, project)
      s1.stop(`Vercel CNAME: ${pc.dim(result.recommendedCNAME)}`)
    }

    // --- Step 2: Clerk secondary domain + 5 CNAMEs ---
    if (clerkKey) {
      const s2 = p.spinner()
      s2.start("Registering Clerk secondary domain + 5 CNAMEs")
      try {
        const result = await setupClerkDomain(config, fullDomain, clerkKey)
        s2.stop(`Clerk: ${pc.green(result.name)} (${result.cnameTargets.length} CNAMEs)`)
        p.log.info(`  Frontend API: ${pc.cyan(result.frontendApiUrl)}`)
        for (const cname of result.cnameTargets) {
          p.log.info(`  ${pc.dim(cname.host)} -> ${pc.dim(cname.value)}`)
        }
      } catch (err) {
        s2.stop(pc.yellow("Clerk registration failed"))
        p.log.warning(
          `${(err as Error).message}`
        )
      }
    }

    // --- Summary ---
    const parts = []
    if (!skipVercel) parts.push("Vercel")
    if (clerkKey) parts.push("Clerk")
    parts.push("DNS")

    p.outro(
      `${pc.green(fullDomain)} configured (${parts.join(" + ")}). SSL issued automatically.`
    )
  },
})

export const domainRemove = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a subdomain from a Vercel project",
  },
  args: {
    subdomain: {
      type: "positional",
      description: "Subdomain to remove",
      required: true,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Vercel project slug",
      required: true,
    },
  },
  async run({ args }) {
    p.intro(pc.bgRed(pc.black(" domain remove ")))

    const config = await resolveConfig()
    const fullDomain = `${args.subdomain}.${config.baseDomain}`

    p.log.info(`Domain: ${pc.cyan(fullDomain)}`)
    p.log.info(`Project: ${pc.cyan(args.project)}`)

    const s = p.spinner()
    s.start("Removing domain from Vercel and DNS")
    await removeDomain(config, args.subdomain, args.project)
    s.stop("Domain and DNS records removed")

    p.outro(`${pc.yellow(fullDomain)} has been removed.`)
  },
})

export const domainList = defineCommand({
  meta: {
    name: "list",
    description: "List all configured subdomains",
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(" domain list ")))

    const config = await resolveConfig()

    const s = p.spinner()
    s.start("Fetching DNS records")
    const { records, baseDomain } = await listDomains(config)
    s.stop(`Found ${records.length} CNAME record(s)`)

    if (records.length === 0) {
      p.log.warning("No CNAME records found.")
    } else {
      for (const record of records) {
        p.log.info(
          `${pc.cyan(record.name + "." + baseDomain)} ${pc.dim("->")} ${pc.dim(record.cname ?? "")}`
        )
      }
    }

    p.outro(`${pc.dim(baseDomain)} - ${records.length} record(s)`)
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
