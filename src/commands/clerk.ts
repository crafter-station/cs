import { defineCommand } from "citty"
import * as p from "@clack/prompts"
import pc from "picocolors"
import { resolveConfig } from "../lib/domain-ops"
import {
  createClerkPlatformClient,
  type PlatformApplication,
} from "../lib/clerk-platform"
import { createSpaceshipClient } from "../lib/spaceship"

function requirePlatformToken(token: string | undefined): string {
  if (!token) {
    throw new Error(
      "Missing Clerk Platform token. Run `crafters login --clerkPlatformToken=...` or set CLERK_PLATFORM_TOKEN"
    )
  }
  return token
}

const clerkList = defineCommand({
  meta: {
    name: "list",
    description: "List all Clerk Platform applications",
  },
  async run() {
    p.intro(pc.bgMagenta(pc.black(" clerk list ")))

    const config = await resolveConfig()
    const token = requirePlatformToken(config.clerkPlatformToken)
    const clerk = createClerkPlatformClient({ token })

    const s = p.spinner()
    s.start("Fetching applications")
    const apps = await clerk.listApplications(true)
    s.stop(`Found ${apps.length} application(s)`)

    if (apps.length === 0) {
      p.log.warning("No applications found.")
      p.outro(pc.dim("Create one with `crafters clerk create`"))
      return
    }

    for (const app of apps) {
      p.log.info(
        `${pc.cyan(app.name)} ${pc.dim(`(${app.application_id})`)}`
      )
      for (const inst of app.instances) {
        const envColor = inst.environment_type === "production" ? pc.green : pc.yellow
        const keyLine = inst.publishable_key
          ? `  pk: ${pc.dim(inst.publishable_key)}`
          : ""
        p.log.info(
          `  ${envColor(inst.environment_type)}${keyLine}`
        )
      }
    }

    p.outro(`${apps.length} application(s)`)
  },
})

const clerkCreate = defineCommand({
  meta: {
    name: "create",
    description: "Create a new Clerk Platform application",
  },
  args: {
    name: {
      type: "positional",
      description: "Application name",
    },
    template: {
      type: "string",
      alias: "t",
      description: "Template: b2c-saas, b2b-saas, or waitlist",
    },
    domain: {
      type: "string",
      alias: "d",
      description: "Custom domain for the application",
    },
  },
  async run({ args }) {
    p.intro(pc.bgMagenta(pc.black(" clerk create ")))

    const config = await resolveConfig()
    const token = requirePlatformToken(config.clerkPlatformToken)
    const clerk = createClerkPlatformClient({ token })

    let name = args.name as string | undefined
    if (!name) {
      const result = await p.text({
        message: "Application name:",
        validate: (v) => (v.length > 0 ? undefined : "Name is required"),
      })
      if (p.isCancel(result)) {
        p.cancel("Cancelled")
        process.exit(0)
      }
      name = result
    }

    let template = args.template as string | undefined
    if (!template) {
      const result = await p.select({
        message: "Template:",
        options: [
          { value: "b2c-saas", label: "B2C SaaS" },
          { value: "b2b-saas", label: "B2B SaaS" },
          { value: "waitlist", label: "Waitlist" },
        ],
      })
      if (p.isCancel(result)) {
        p.cancel("Cancelled")
        process.exit(0)
      }
      template = result as string
    }

    const s = p.spinner()
    s.start("Creating application")
    const app = await clerk.createApplication({
      name,
      template,
      domain: args.domain as string | undefined,
      environment_types: ["development", "production"],
    })
    s.stop(`Created ${pc.cyan(app.name)} ${pc.dim(`(${app.application_id})`)}`)

    for (const inst of app.instances) {
      const envColor = inst.environment_type === "production" ? pc.green : pc.yellow
      p.log.info(`${envColor(inst.environment_type)}:`)
      p.log.info(`  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${inst.publishable_key}`)
      if (inst.secret_key) {
        p.log.info(`  CLERK_SECRET_KEY=${inst.secret_key}`)
      }
    }

    p.outro(`Application ${pc.green(app.name)} created`)
  },
})

const clerkGoLive = defineCommand({
  meta: {
    name: "go-live",
    description:
      "Set production domain, create DNS records, verify, and show keys",
  },
  args: {
    subdomain: {
      type: "positional",
      description:
        "Subdomain (e.g., 'myapp' for myapp.crafter.run)",
    },
    app: {
      type: "string",
      alias: "a",
      description: "Clerk application ID",
    },
    domain: {
      type: "string",
      alias: "d",
      description: "Full custom domain (overrides subdomain.baseDomain)",
    },
  },
  async run({ args }) {
    p.intro(pc.bgGreen(pc.black(" clerk go-live ")))

    const config = await resolveConfig()
    const token = requirePlatformToken(config.clerkPlatformToken)
    const clerk = createClerkPlatformClient({ token })

    // --- Resolve app ---
    let appId = args.app as string | undefined
    if (!appId) {
      const s = p.spinner()
      s.start("Fetching applications")
      const apps = await clerk.listApplications()
      s.stop(`Found ${apps.length} application(s)`)

      if (apps.length === 0) {
        p.log.error("No applications found. Create one first with `crafters clerk create`")
        process.exit(1)
      }

      const result = await p.select({
        message: "Select application:",
        options: apps.map((a) => ({
          value: a.application_id,
          label: `${a.name} ${pc.dim(`(${a.application_id})`)}`,
        })),
      })
      if (p.isCancel(result)) {
        p.cancel("Cancelled")
        process.exit(0)
      }
      appId = result as string
    }

    // --- Ensure production instance exists ---
    const appDetail = await clerk.getApplication(appId)
    const hasProd = appDetail.instances.some(
      (i) => i.environment_type === "production"
    )
    if (!hasProd) {
      p.log.warning(
        `${pc.cyan(appDetail.name)} has no production instance.`
      )
      const recreate = await p.confirm({
        message: "Create a new app with production enabled? (the old dev-only app will remain)",
      })
      if (p.isCancel(recreate) || !recreate) {
        p.cancel("Cancelled — production instance required for go-live")
        process.exit(0)
      }
      const s = p.spinner()
      s.start("Creating new app with production instance")
      const newApp = await clerk.createApplication({
        name: appDetail.name,
        environment_types: ["development", "production"],
      })
      s.stop(
        `Created ${pc.cyan(newApp.name)} ${pc.dim(`(${newApp.application_id})`)} with production`
      )
      appId = newApp.application_id
    }

    // --- Resolve domain ---
    let fullDomain: string
    if (args.domain) {
      fullDomain = args.domain as string
    } else if (args.subdomain) {
      fullDomain = `${args.subdomain}.${config.baseDomain}`
    } else {
      const result = await p.text({
        message: `Subdomain (will be appended to .${config.baseDomain}):`,
        validate: (v) => (v.length > 0 ? undefined : "Subdomain is required"),
      })
      if (p.isCancel(result)) {
        p.cancel("Cancelled")
        process.exit(0)
      }
      fullDomain = `${result}.${config.baseDomain}`
    }

    p.log.info(`App:    ${pc.cyan(appId)}`)
    p.log.info(`Domain: ${pc.cyan(fullDomain)}`)

    // --- Step 1: Set production domain ---
    const s1 = p.spinner()
    s1.start("Setting production domain")
    await clerk.updateProductionDomain(appId, { name: fullDomain })
    s1.stop(`Production domain set to ${pc.green(fullDomain)}`)

    // --- Step 2: Read CNAME targets ---
    const s2 = p.spinner()
    s2.start("Reading CNAME targets")
    const domains = await clerk.listDomains(appId)
    s2.stop(`Found ${domains.length} domain(s)`)

    const targetDomain = domains.find((d) => d.name === fullDomain)
    if (!targetDomain) {
      p.log.error(`Domain ${fullDomain} not found after setting production domain`)
      process.exit(1)
    }

    for (const cname of targetDomain.cname_targets) {
      p.log.info(`  ${pc.dim(cname.host)} -> ${pc.dim(cname.value)}`)
    }

    // --- Step 3: Create DNS records ---
    const s3 = p.spinner()
    s3.start("Creating DNS records via Spaceship")
    const spaceship = createSpaceshipClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseDomain: config.baseDomain,
    })

    for (const cname of targetDomain.cname_targets) {
      const sub = cname.host.replace(`.${config.baseDomain}`, "")
      await spaceship.addCNAME(sub, cname.value)
    }
    s3.stop(`Created ${targetDomain.cname_targets.length} CNAME record(s)`)

    // --- Step 4: Trigger DNS check ---
    const s4 = p.spinner()
    s4.start("Triggering DNS verification")
    await clerk.triggerDnsCheck(appId, targetDomain.id)
    s4.stop("DNS check triggered")

    // --- Step 5: Poll verification ---
    const s5 = p.spinner()
    s5.start("Verifying DNS + SSL")

    let verified = false
    let delay = 3000
    const maxDelay = 15000
    const deadline = Date.now() + 2 * 60 * 1000 // 2 minutes

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, delay))
      try {
        const status = await clerk.getDomainStatus(appId, targetDomain.id)
        s5.message = `DNS: ${status.dns_status}, SSL: ${status.ssl_status}`
        if (status.dns_status === "verified" && status.ssl_status === "active") {
          verified = true
          break
        }
      } catch {
        // keep polling
      }
      delay = Math.min(delay * 1.5, maxDelay)
    }

    if (verified) {
      s5.stop(pc.green("DNS verified + SSL active"))
    } else {
      s5.stop(pc.yellow("Verification still in progress"))
      p.log.warning(
        "DNS/SSL not fully verified yet. This can take a few minutes — re-check with `crafters clerk list`."
      )
    }

    // --- Step 6: Show keys ---
    const s6 = p.spinner()
    s6.start("Fetching keys")
    const app = await clerk.getApplication(appId, true)
    s6.stop("Keys ready")

    const prodInstance = app.instances.find(
      (i) => i.environment_type === "production"
    )
    if (prodInstance) {
      p.log.info("")
      p.log.info(pc.bold("Production keys:"))
      p.log.info(
        `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${prodInstance.publishable_key}`
      )
      if (prodInstance.secret_key) {
        p.log.info(`CLERK_SECRET_KEY=${prodInstance.secret_key}`)
      }
    }

    p.outro(
      verified
        ? `${pc.green(fullDomain)} is live!`
        : `${pc.yellow(fullDomain)} domain set — verification in progress`
    )
  },
})

export const clerk = defineCommand({
  meta: {
    name: "clerk",
    description: "Manage Clerk Platform applications",
  },
  subCommands: {
    list: clerkList,
    create: clerkCreate,
    "go-live": clerkGoLive,
  },
})
