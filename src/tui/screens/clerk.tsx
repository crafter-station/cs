import { createSignal, For, Show, onMount, createMemo } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"
import { useRoute } from "../context/route"
import { useToast } from "../context/toast"
import { useDialog } from "../context/dialog"
import { Spinner } from "../components/spinner"
import { Toast } from "../components/toast"
import { resolveConfig, type ResolvedConfig } from "../../lib/domain-ops"
import {
  createClerkPlatformClient,
  type PlatformApplication,
  type ClerkPlatformClient,
} from "../../lib/clerk-platform"
import { createSpaceshipClient } from "../../lib/spaceship"

export function ClerkScreen() {
  const route = useRoute()
  const toast = useToast()
  const dialog = useDialog()

  const [loading, setLoading] = createSignal(true)
  const [apps, setApps] = createSignal<PlatformApplication[]>([])
  const [selected, setSelected] = createSignal(0)
  const [config, setConfig] = createSignal<ResolvedConfig | null>(null)
  const [client, setClient] = createSignal<ClerkPlatformClient | null>(null)

  async function loadApps() {
    setLoading(true)
    try {
      const cfg = await resolveConfig()
      setConfig(cfg)
      if (!cfg.clerkPlatformToken) {
        toast.show({
          variant: "warning",
          message: "No Clerk Platform token. Run `crafters login --clerkPlatformToken=...`",
        })
        setLoading(false)
        return
      }
      const cl = createClerkPlatformClient({ token: cfg.clerkPlatformToken })
      setClient(cl)
      const result = await cl.listApplications(true)
      setApps(result)
    } catch (err) {
      toast.error(err)
    } finally {
      setLoading(false)
    }
  }

  onMount(loadApps)

  useKeyboard((evt) => {
    if (dialog.isOpen) return

    if (evt.name === "escape") {
      route.navigate({ type: "home" })
      evt.preventDefault()
      return
    }
    if (evt.name === "r") {
      loadApps()
      evt.preventDefault()
      return
    }

    const list = apps()
    if (list.length > 0) {
      if (evt.name === "up" || evt.name === "k") {
        setSelected((i) => (i > 0 ? i - 1 : list.length - 1))
        evt.preventDefault()
      }
      if (evt.name === "down" || evt.name === "j") {
        setSelected((i) => (i < list.length - 1 ? i + 1 : 0))
        evt.preventDefault()
      }
    }

    if (evt.name === "c" && client()) {
      evt.preventDefault()
      dialog.replace(() => (
        <CreateAppForm client={client()!} onDone={loadApps} />
      ))
      return
    }

    if (evt.name === "g" && list.length > 0 && config() && client()) {
      evt.preventDefault()
      const app = list[selected()]
      dialog.replace(() => (
        <GoLiveForm
          app={app}
          config={config()!}
          client={client()!}
          onDone={loadApps}
        />
      ))
      return
    }

    if (evt.name === "return" && list.length > 0) {
      evt.preventDefault()
      const app = list[selected()]
      dialog.replace(() => <AppDetail app={app} />)
      return
    }
  })

  return (
    <>
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <box flexDirection="row" marginBottom={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Clerk Applications
          </text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>
            c:create  g:go-live  r:refresh  enter:details  esc:back
          </text>
        </box>

        <Show
          when={!loading()}
          fallback={<Spinner>Loading applications...</Spinner>}
        >
          <Show
            when={apps().length > 0}
            fallback={
              <text fg={theme.textMuted}>
                No applications found. Press 'c' to create one.
              </text>
            }
          >
            <For each={apps()}>
              {(app, index) => {
                const isSelected = () => index() === selected()
                const envs = app.instances
                  .map((i) => i.environment_type)
                  .join(", ")
                return (
                  <box
                    flexDirection="row"
                    gap={1}
                    backgroundColor={
                      isSelected() ? theme.backgroundElement : undefined
                    }
                    paddingLeft={1}
                    paddingRight={1}
                  >
                    <text fg={isSelected() ? theme.primary : theme.textMuted}>
                      {isSelected() ? ">" : " "}
                    </text>
                    <text fg={isSelected() ? theme.secondary : theme.text}>
                      {app.name}
                    </text>
                    <text fg={theme.textMuted}>{app.application_id}</text>
                    <text fg={theme.textMuted}>[{envs}]</text>
                  </box>
                )
              }}
            </For>
            <text fg={theme.textMuted} marginTop={1}>
              {apps().length} application(s)
            </text>
          </Show>
        </Show>
      </box>
      <Toast />
    </>
  )
}

// --- App Detail Dialog ---

function buildEnvLines(instances: PlatformApplication["instances"], env?: string) {
  const lines: string[] = []
  const filtered = env ? instances.filter((i) => i.environment_type === env) : instances
  for (const inst of filtered) {
    if (inst.publishable_key) {
      lines.push(`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${inst.publishable_key}`)
    }
    if (inst.secret_key) {
      lines.push(`CLERK_SECRET_KEY=${inst.secret_key}`)
    }
  }
  return lines.join("\n")
}

async function copyToClipboard(text: string) {
  const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" })
  proc.stdin.write(text)
  proc.stdin.end()
  await proc.exited
}

function AppDetail(props: { app: PlatformApplication }) {
  const dialog = useDialog()
  const toast = useToast()
  const [envFilter, setEnvFilter] = createSignal<string | undefined>(undefined)

  const envTypes = () => [...new Set(props.app.instances.map((i) => i.environment_type))]

  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "return") {
      dialog.clear()
      evt.preventDefault()
      return
    }
    if (evt.name === "c") {
      evt.preventDefault()
      const text = buildEnvLines(props.app.instances, envFilter())
      if (text) {
        copyToClipboard(text).then(() => {
          const label = envFilter() ?? "all"
          toast.show({ variant: "success", message: `Copied ${label} keys` })
        })
      }
      return
    }
    // number keys to filter by env
    const types = envTypes()
    const num = parseInt(evt.name)
    if (num >= 1 && num <= types.length) {
      evt.preventDefault()
      const picked = types[num - 1]
      setEnvFilter((cur) => (cur === picked ? undefined : picked))
      return
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        {props.app.name}
      </text>
      <text fg={theme.textMuted}>ID: {props.app.application_id}</text>
      <For each={props.app.instances}>
        {(inst) => {
          const dimmed = () => envFilter() && envFilter() !== inst.environment_type
          return (
            <box flexDirection="column" marginTop={1}>
              <text
                fg={
                  dimmed()
                    ? theme.textMuted
                    : inst.environment_type === "production"
                      ? theme.success
                      : theme.warning
                }
                attributes={dimmed() ? undefined : TextAttributes.BOLD}
              >
                {inst.environment_type}
              </text>
              <Show when={inst.publishable_key}>
                <text fg={dimmed() ? theme.textMuted : theme.text}>
                  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
                  {inst.publishable_key}
                </text>
              </Show>
              <Show when={inst.secret_key}>
                <text fg={dimmed() ? theme.textMuted : theme.text}>
                  CLERK_SECRET_KEY={inst.secret_key}
                </text>
              </Show>
              <Show when={!inst.publishable_key && !inst.secret_key}>
                <text fg={theme.textMuted}>No keys available</text>
              </Show>
            </box>
          )
        }}
      </For>
      <box flexDirection="row" gap={2} marginTop={1}>
        <text fg={theme.textMuted}>
          c:copy{" "}
          <For each={envTypes()}>
            {(env, i) => <>{i() + 1}:{env}{" "}</>}
          </For>
          esc:close
        </text>
      </box>
    </box>
  )
}

// --- Create App Dialog ---

function CreateAppForm(props: {
  client: ClerkPlatformClient
  onDone: () => void
}) {
  const dialog = useDialog()
  const toast = useToast()
  const [name, setName] = createSignal("")
  const [step, setStep] = createSignal<
    "name" | "template" | "creating" | "done"
  >("name")
  const [templateIndex, setTemplateIndex] = createSignal(0)
  const [created, setCreated] = createSignal<PlatformApplication | null>(null)

  const templates = [
    { value: "b2c-saas", label: "B2C SaaS" },
    { value: "b2b-saas", label: "B2B SaaS" },
    { value: "waitlist", label: "Waitlist" },
  ]

  useKeyboard((evt) => {
    if (step() === "creating") return

    if (evt.name === "c" && step() === "done" && created()) {
      evt.preventDefault()
      const text = buildEnvLines(created()!.instances)
      if (text) {
        copyToClipboard(text).then(() => {
          toast.show({ variant: "success", message: "Copied keys" })
        })
      }
      return
    }

    if (evt.name === "escape") {
      evt.preventDefault()
      if (step() === "done") {
        dialog.clear()
        props.onDone()
      } else if (step() === "template") {
        setStep("name")
      } else {
        dialog.clear()
      }
      return
    }

    if (evt.name === "return") {
      evt.preventDefault()
      if (step() === "name" && name().length > 0) {
        setStep("template")
      } else if (step() === "template") {
        handleCreate()
      } else if (step() === "done") {
        dialog.clear()
        props.onDone()
      }
      return
    }

    if (evt.name === "backspace") {
      evt.preventDefault()
      if (step() === "name") {
        setName((v) => v.slice(0, -1))
      }
      return
    }

    if (step() === "template") {
      if (evt.name === "up" || evt.name === "k") {
        setTemplateIndex((i) => (i > 0 ? i - 1 : templates.length - 1))
        evt.preventDefault()
      }
      if (evt.name === "down" || evt.name === "j") {
        setTemplateIndex((i) => (i < templates.length - 1 ? i + 1 : 0))
        evt.preventDefault()
      }
      return
    }

    if (step() === "name" && evt.name.length === 1 && !evt.ctrl && !evt.meta) {
      evt.preventDefault()
      setName((v) => v + evt.name)
    }
  })

  async function handleCreate() {
    setStep("creating")
    try {
      const app = await props.client.createApplication({
        name: name(),
        template: templates[templateIndex()].value,
        environment_types: ["development", "production"],
      })
      setCreated(app)
      setStep("done")
    } catch (err) {
      toast.error(err)
      setStep("template")
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Create Application
      </text>
      <box flexDirection="row" gap={1}>
        <text fg={theme.textMuted}>Name:</text>
        <text fg={step() === "name" ? theme.primary : theme.text}>
          {name() || (step() === "name" ? "\u258C" : "")}
          {step() === "name" && name().length > 0 ? "\u258C" : ""}
        </text>
      </box>
      <Show when={step() === "template" || step() === "creating"}>
        <text fg={theme.textMuted}>Template:</text>
        <For each={templates}>
          {(t, index) => {
            const isSel = () => index() === templateIndex()
            return (
              <box flexDirection="row" gap={1} paddingLeft={1}>
                <text fg={isSel() ? theme.primary : theme.textMuted}>
                  {isSel() ? ">" : " "}
                </text>
                <text fg={isSel() ? theme.secondary : theme.text}>
                  {t.label}
                </text>
              </box>
            )
          }}
        </For>
      </Show>
      <Show when={step() === "creating"}>
        <Spinner>Creating application...</Spinner>
      </Show>
      <Show when={step() === "done" && created()}>
        <box flexDirection="column" gap={1}>
          <box flexDirection="row" gap={1}>
            <text fg={theme.success}>{"\u2713"}</text>
            <text fg={theme.text}>
              {created()!.name} created ({created()!.id})
            </text>
          </box>
          <For each={created()!.instances}>
            {(inst) => (
              <box flexDirection="column">
                <text
                  fg={
                    inst.environment_type === "production"
                      ? theme.success
                      : theme.warning
                  }
                >
                  {inst.environment_type}:
                </text>
                <Show when={inst.publishable_key}>
                  <text fg={theme.text}>
                    {"  "}NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
                    {inst.publishable_key}
                  </text>
                </Show>
                <Show when={inst.secret_key}>
                  <text fg={theme.text}>
                    {"  "}CLERK_SECRET_KEY={inst.secret_key}
                  </text>
                </Show>
              </box>
            )}
          </For>
        </box>
      </Show>
      <text fg={theme.textMuted}>
        {step() === "name"
          ? "Enter to continue, Esc to cancel"
          : step() === "template"
            ? "\u2191\u2193 select, Enter to create, Esc to go back"
            : step() === "done"
              ? "c:copy keys  enter/esc:close"
              : ""}
      </text>
    </box>
  )
}

// --- Go Live Dialog ---

function GoLiveForm(props: {
  app: PlatformApplication
  config: ResolvedConfig
  client: ClerkPlatformClient
  onDone: () => void
}) {
  const dialog = useDialog()
  const toast = useToast()
  const [subdomain, setSubdomain] = createSignal("")
  const [step, setStep] = createSignal<
    "subdomain" | "working" | "polling" | "done"
  >("subdomain")
  const [status, setStatus] = createSignal("")
  const [prodKeys, setProdKeys] = createSignal<{
    publishable: string
    secret?: string
  } | null>(null)

  useKeyboard((evt) => {
    if (step() === "working" || step() === "polling") return

    if (evt.name === "escape") {
      evt.preventDefault()
      if (step() === "done") {
        dialog.clear()
        props.onDone()
      } else {
        dialog.clear()
      }
      return
    }

    if (evt.name === "c" && step() === "done" && prodKeys()) {
      evt.preventDefault()
      const lines: string[] = []
      lines.push(`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${prodKeys()!.publishable}`)
      if (prodKeys()!.secret) lines.push(`CLERK_SECRET_KEY=${prodKeys()!.secret}`)
      copyToClipboard(lines.join("\n")).then(() => {
        toast.show({ variant: "success", message: "Copied production keys" })
      })
      return
    }

    if (evt.name === "return") {
      evt.preventDefault()
      if (step() === "subdomain" && subdomain().length > 0) {
        handleGoLive()
      } else if (step() === "done") {
        dialog.clear()
        props.onDone()
      }
      return
    }

    if (evt.name === "backspace" && step() === "subdomain") {
      evt.preventDefault()
      setSubdomain((v) => v.slice(0, -1))
      return
    }

    if (
      step() === "subdomain" &&
      evt.name.length === 1 &&
      !evt.ctrl &&
      !evt.meta
    ) {
      evt.preventDefault()
      setSubdomain((v) => v + evt.name)
    }
  })

  async function handleGoLive() {
    setStep("working")
    const fullDomain = `${subdomain()}.${props.config.baseDomain}`
    let appId = props.app.application_id

    try {
      // Ensure production instance exists
      const hasProd = props.app.instances.some(
        (i) => i.environment_type === "production"
      )
      if (!hasProd) {
        setStatus("No production instance — creating new app with production...")
        const newApp = await props.client.createApplication({
          name: props.app.name,
          environment_types: ["development", "production"],
        })
        appId = newApp.application_id
      }

      // Set production domain
      setStatus(`Setting production domain to ${fullDomain}...`)
      await props.client.updateProductionDomain(appId, {
        name: fullDomain,
      })

      // Read CNAME targets
      setStatus("Reading CNAME targets...")
      const domains = await props.client.listDomains(appId)
      const targetDomain = domains.find((d) => d.name === fullDomain)
      if (!targetDomain) {
        throw new Error(`Domain ${fullDomain} not found after update`)
      }

      // Create DNS records
      setStatus(
        `Creating ${targetDomain.cname_targets.length} DNS record(s)...`
      )
      const spaceship = createSpaceshipClient({
        apiKey: props.config.apiKey,
        apiSecret: props.config.apiSecret,
        baseDomain: props.config.baseDomain,
      })

      for (const cname of targetDomain.cname_targets) {
        const sub = cname.host.replace(`.${props.config.baseDomain}`, "")
        await spaceship.addCNAME(sub, cname.value)
      }

      // Trigger DNS check
      setStatus("Triggering DNS verification...")
      await props.client.triggerDnsCheck(appId, targetDomain.id)

      // Poll verification
      setStep("polling")
      let verified = false
      let delay = 3000
      const maxDelay = 15000
      const deadline = Date.now() + 2 * 60 * 1000

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, delay))
        try {
          const s = await props.client.getDomainStatus(
            appId,
            targetDomain.id
          )
          setStatus(`DNS: ${s.dns_status}, SSL: ${s.ssl_status}`)
          if (s.dns_status === "verified" && s.ssl_status === "active") {
            verified = true
            break
          }
        } catch {
          // keep polling
        }
        delay = Math.min(delay * 1.5, maxDelay)
      }

      if (!verified) {
        setStatus("Verification still in progress — check back later")
      }

      // Fetch keys
      const app = await props.client.getApplication(appId, true)
      const prod = app.instances.find(
        (i) => i.environment_type === "production"
      )
      if (prod) {
        setProdKeys({
          publishable: prod.publishable_key ?? "",
          secret: prod.secret_key,
        })
      }

      setStep("done")
    } catch (err) {
      toast.error(err)
      setStep("subdomain")
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Go Live — {props.app.name}
      </text>
      <box flexDirection="row" gap={1}>
        <text fg={theme.textMuted}>Subdomain:</text>
        <text fg={step() === "subdomain" ? theme.primary : theme.text}>
          {subdomain() || (step() === "subdomain" ? "\u258C" : "")}
          {step() === "subdomain" && subdomain().length > 0 ? "\u258C" : ""}
        </text>
        <text fg={theme.textMuted}>.{props.config.baseDomain}</text>
      </box>
      <Show when={step() === "working" || step() === "polling"}>
        <Spinner>{status()}</Spinner>
      </Show>
      <Show when={step() === "done"}>
        <box flexDirection="column" gap={1}>
          <box flexDirection="row" gap={1}>
            <text fg={theme.success}>{"\u2713"}</text>
            <text fg={theme.text}>
              {subdomain()}.{props.config.baseDomain}
            </text>
          </box>
          <Show when={prodKeys()}>
            <text fg={theme.success} attributes={TextAttributes.BOLD}>
              Production keys:
            </text>
            <text fg={theme.text}>
              NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY={prodKeys()!.publishable}
            </text>
            <Show when={prodKeys()!.secret}>
              <text fg={theme.text}>
                CLERK_SECRET_KEY={prodKeys()!.secret}
              </text>
            </Show>
          </Show>
          <Show when={status()}>
            <text fg={theme.textMuted}>{status()}</text>
          </Show>
        </box>
      </Show>
      <text fg={theme.textMuted}>
        {step() === "subdomain"
          ? "Enter to go live, Esc to cancel"
          : step() === "done"
            ? "c:copy keys  enter/esc:close"
            : ""}
      </text>
    </box>
  )
}
