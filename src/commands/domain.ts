import { defineCommand } from "citty"
import * as p from "@clack/prompts"
import pc from "picocolors"
import { basename } from "node:path"
import {
  resolveConfig,
  addDomain,
  addClerkDomain,
  removeDomain,
  listDomains,
  detectVercelProject,
  detectClerk,
} from "../lib/domain-ops"

export const domainAdd = defineCommand({
  meta: {
    name: "add",
    description: "Add a subdomain to a Vercel project with smart detection",
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
    "no-clerk": {
      type: "boolean",
      description: "Skip Clerk satellite domain setup",
      default: false,
    },
    "no-vercel": {
      type: "boolean",
      description: "Skip Vercel, only set up Clerk DNS",
      default: false,
    },
    target: {
      type: "string",
      alias: "t",
      description: "Custom CNAME target (DNS-only, skips Vercel and Clerk)",
    },
  },
  async run({ args }) {
    p.intro(pc.bgMagenta(pc.black(" domain add ")))

    const config = await resolveConfig()
    const cwd = process.cwd()

    // --- Resolve subdomain ---
    const subdomain = args.subdomain || basename(cwd)
    const fullDomain = `${subdomain}.${config.baseDomain}`

    // --- Custom target mode: just DNS, no detection ---
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

    // --- Auto-detect Clerk ---
    const skipClerk = args["no-clerk"]
    const hasClerk = !skipClerk && detectClerk(cwd)

    // --- Show what we detected ---
    p.log.info(`Domain: ${pc.cyan(fullDomain)}`)
    if (!skipVercel) {
      p.log.info(`Vercel: ${pc.cyan(project)} ${!args.project ? pc.dim("(auto-detected)") : ""}`)
    }
    if (hasClerk) {
      p.log.info(`Clerk:  ${pc.green("detected")} ${pc.dim("(will register satellite domain)")}`)
    }

    // --- Step 1: Vercel + DNS ---
    if (!skipVercel) {
      const s1 = p.spinner()
      s1.start("Adding domain to Vercel + Spaceship DNS")
      const result = await addDomain(config, subdomain, project)
      s1.stop(`Vercel CNAME: ${pc.dim(result.recommendedCNAME)}`)
    }

    // --- Step 2: Clerk satellite domain ---
    if (hasClerk) {
      const s2 = p.spinner()
      s2.start("Registering Clerk satellite domain + DNS")
      try {
        const result = await addClerkDomain(config, fullDomain)
        const count = result.cnameTargets.length
        s2.stop(`Clerk: ${pc.dim(count + " CNAME(s) configured")}`)
        for (const cname of result.cnameTargets) {
          p.log.info(`  ${pc.cyan(cname.host)} -> ${pc.dim(cname.value)}`)
        }
      } catch {
        s2.stop(pc.yellow("Clerk registration failed"))
        p.log.warning(
          `Run manually: ${pc.dim(`clerk domains add --name ${fullDomain} --dotenv`)}`
        )
      }
    }

    // --- Summary ---
    const parts = []
    if (!skipVercel) parts.push("Vercel")
    if (hasClerk) parts.push("Clerk")
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
