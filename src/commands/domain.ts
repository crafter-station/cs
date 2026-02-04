import { defineCommand } from "citty"
import * as p from "@clack/prompts"
import pc from "picocolors"
import { resolveConfig, addDomain, removeDomain, listDomains } from "../lib/domain-ops"

export const domainAdd = defineCommand({
  meta: {
    name: "add",
    description: "Add a subdomain to a Vercel project",
  },
  args: {
    subdomain: {
      type: "positional",
      description: "Subdomain to add (e.g., 'myapp' for myapp.crafter.run)",
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
    p.intro(pc.bgMagenta(pc.black(" domain add ")))

    const config = await resolveConfig()
    const fullDomain = `${args.subdomain}.${config.baseDomain}`

    p.log.info(`Domain: ${pc.cyan(fullDomain)}`)
    p.log.info(`Project: ${pc.cyan(args.project)}`)

    const s = p.spinner()
    s.start("Adding domain to Vercel and configuring DNS")
    const result = await addDomain(config, args.subdomain, args.project)
    s.stop(`CNAME configured: ${pc.dim(result.recommendedCNAME)}`)

    p.outro(
      `${pc.green(result.fullDomain)} is now configured. SSL will be issued automatically.`
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
    const result = await removeDomain(config, args.subdomain, args.project)
    s.stop("Domain and DNS records removed")

    p.outro(`${pc.yellow(result.fullDomain)} has been removed.`)
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
