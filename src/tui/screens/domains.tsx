import { createSignal, For, Show, onMount, createMemo } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"
import { useRoute } from "../context/route"
import { useToast } from "../context/toast"
import { useDialog } from "../context/dialog"
import { Spinner } from "../components/spinner"
import { Toast } from "../components/toast"
import {
  resolveConfig,
  listDomains,
  listProjects,
  addDomain,
  removeDomain,
  type ResolvedConfig,
  type VercelProject,
} from "../../lib/domain-ops"

interface DomainRecord {
  type: string
  name: string
  cname?: string
  ttl: number
}

export function Domains() {
  const route = useRoute()
  const toast = useToast()
  const dialog = useDialog()

  const [loading, setLoading] = createSignal(true)
  const [records, setRecords] = createSignal<DomainRecord[]>([])
  const [baseDomain, setBaseDomain] = createSignal("crafter.run")
  const [selected, setSelected] = createSignal(0)
  const [config, setConfig] = createSignal<ResolvedConfig | null>(null)
  const [busy, setBusy] = createSignal(false)

  async function loadDomains() {
    setLoading(true)
    try {
      const cfg = await resolveConfig()
      setConfig(cfg)
      const result = await listDomains(cfg)
      setRecords(result.records)
      setBaseDomain(result.baseDomain)
    } catch (err) {
      toast.error(err)
    } finally {
      setLoading(false)
    }
  }

  onMount(loadDomains)

  useKeyboard((evt) => {
    if (busy()) return
    // Skip when dialog is open — dialog handles its own keys
    if (dialog.isOpen) return

    if (evt.name === "escape") {
      route.navigate({ type: "home" })
      evt.preventDefault()
      return
    }
    if (evt.name === "r") {
      loadDomains()
      evt.preventDefault()
      return
    }

    const recs = records()
    if (recs.length > 0) {
      if (evt.name === "up" || evt.name === "k") {
        setSelected((i) => (i > 0 ? i - 1 : recs.length - 1))
        evt.preventDefault()
      }
      if (evt.name === "down" || evt.name === "j") {
        setSelected((i) => (i < recs.length - 1 ? i + 1 : 0))
        evt.preventDefault()
      }
    }

    if (evt.name === "a" && config()) {
      evt.preventDefault()
      dialog.replace(() => <AddDomainForm onDone={loadDomains} config={config()!} />)
      return
    }

    if (evt.name === "d" && recs.length > 0 && config()) {
      evt.preventDefault()
      const record = recs[selected()]
      dialog.replace(() => (
        <ConfirmRemove
          subdomain={record.name}
          baseDomain={baseDomain()}
          config={config()!}
          onDone={loadDomains}
        />
      ))
      return
    }
  })

  return (
    <>
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <box flexDirection="row" marginBottom={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Domains
          </text>
          <text fg={theme.textMuted}> - {baseDomain()}</text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>
            a:add  d:remove  r:refresh  esc:back
          </text>
        </box>

        <Show
          when={!loading()}
          fallback={<Spinner>Loading domains...</Spinner>}
        >
          <Show
            when={records().length > 0}
            fallback={<text fg={theme.textMuted}>No CNAME records found. Press 'a' to add one.</text>}
          >
            <For each={records()}>
              {(record, index) => {
                const isSelected = () => index() === selected()
                return (
                  <box
                    flexDirection="row"
                    gap={1}
                    backgroundColor={isSelected() ? theme.backgroundElement : undefined}
                    paddingLeft={1}
                    paddingRight={1}
                  >
                    <text fg={isSelected() ? theme.primary : theme.textMuted}>
                      {isSelected() ? ">" : " "}
                    </text>
                    <text fg={isSelected() ? theme.secondary : theme.text}>
                      {record.name}.{baseDomain()}
                    </text>
                    <text fg={theme.textMuted}>{"→"}</text>
                    <text fg={theme.textMuted}>{record.cname ?? ""}</text>
                  </box>
                )
              }}
            </For>
            <text fg={theme.textMuted} marginTop={1}>
              {records().length} record(s)
            </text>
          </Show>
        </Show>
      </box>
      <Toast />
    </>
  )
}

function AddDomainForm(props: {
  onDone: () => void
  config: ResolvedConfig
}) {
  const dialog = useDialog()
  const toast = useToast()
  const [subdomain, setSubdomain] = createSignal("")
  const [step, setStep] = createSignal<"subdomain" | "loading" | "project" | "adding" | "done">("subdomain")
  const [addedDomain, setAddedDomain] = createSignal("")
  const [projects, setProjects] = createSignal<VercelProject[]>([])
  const [filter, setFilter] = createSignal("")
  const [projectIndex, setProjectIndex] = createSignal(0)

  const filtered = createMemo(() => {
    const q = filter().toLowerCase()
    if (!q) return projects()
    return projects().filter((p) => p.name.toLowerCase().includes(q))
  })

  async function loadProjects() {
    setStep("loading")
    try {
      const result = await listProjects(props.config)
      setProjects(result)
      setStep("project")
    } catch (err) {
      toast.error(err)
      setStep("subdomain")
    }
  }

  useKeyboard((evt) => {
    if (step() === "adding" || step() === "loading") return

    if (step() === "done") {
      if (evt.name === "return" || evt.name === "escape") {
        evt.preventDefault()
        dialog.clear()
        props.onDone()
      }
      return
    }

    if (evt.name === "return") {
      evt.preventDefault()
      if (step() === "subdomain" && subdomain().length > 0) {
        loadProjects()
      } else if (step() === "project" && filtered().length > 0) {
        const selected = filtered()[projectIndex()]
        if (selected) handleAdd(selected.name)
      }
      return
    }

    if (evt.name === "backspace") {
      evt.preventDefault()
      if (step() === "subdomain") {
        setSubdomain((v) => v.slice(0, -1))
      } else if (step() === "project") {
        if (filter().length === 0) {
          setStep("subdomain")
        } else {
          setFilter((v) => v.slice(0, -1))
          setProjectIndex(0)
        }
      }
      return
    }

    if (step() === "project") {
      if (evt.name === "up" || evt.name === "k") {
        evt.preventDefault()
        setProjectIndex((i) => (i > 0 ? i - 1 : Math.max(0, filtered().length - 1)))
        return
      }
      if (evt.name === "down" || evt.name === "j") {
        evt.preventDefault()
        setProjectIndex((i) => (i < filtered().length - 1 ? i + 1 : 0))
        return
      }
      if (evt.name === "tab") {
        evt.preventDefault()
        setProjectIndex((i) => (i < filtered().length - 1 ? i + 1 : 0))
        return
      }
    }

    if (evt.name.length === 1 && !evt.ctrl && !evt.meta) {
      evt.preventDefault()
      if (step() === "subdomain") {
        setSubdomain((v) => v + evt.name)
      } else if (step() === "project") {
        setFilter((v) => v + evt.name)
        setProjectIndex(0)
      }
    }
  })

  async function handleAdd(projectName: string) {
    setStep("adding")
    try {
      const result = await addDomain(props.config, subdomain(), projectName)
      setAddedDomain(result.fullDomain)
      setStep("done")
    } catch (err) {
      toast.error(err)
      setStep("project")
    }
  }

  const MAX_VISIBLE = 8

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Add Domain
      </text>
      <box flexDirection="row" gap={1}>
        <text fg={theme.textMuted}>Subdomain:</text>
        <text fg={step() === "subdomain" ? theme.primary : theme.text}>
          {subdomain() || (step() === "subdomain" ? "▌" : "")}
          {step() === "subdomain" && subdomain().length > 0 ? "▌" : ""}
        </text>
      </box>
      <Show when={step() === "loading"}>
        <Spinner>Loading projects...</Spinner>
      </Show>
      <Show when={step() === "project" || step() === "adding"}>
        <box flexDirection="column">
          <box flexDirection="row" gap={1}>
            <text fg={theme.textMuted}>Project:</text>
            <text fg={theme.primary}>
              {filter()}{"▌"}
            </text>
            <text fg={theme.textMuted}>
              ({filtered().length}/{projects().length})
            </text>
          </box>
          <For each={filtered().slice(0, MAX_VISIBLE)}>
            {(project, index) => {
              const isSelected = () => index() === projectIndex()
              return (
                <box
                  flexDirection="row"
                  gap={1}
                  backgroundColor={isSelected() ? theme.backgroundElement : undefined}
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <text fg={isSelected() ? theme.primary : theme.textMuted}>
                    {isSelected() ? ">" : " "}
                  </text>
                  <text fg={isSelected() ? theme.secondary : theme.text}>
                    {project.name}
                  </text>
                  <Show when={project.framework}>
                    <text fg={theme.textMuted}>({project.framework})</text>
                  </Show>
                </box>
              )
            }}
          </For>
          <Show when={filtered().length > MAX_VISIBLE}>
            <text fg={theme.textMuted} paddingLeft={3}>
              +{filtered().length - MAX_VISIBLE} more — type to filter
            </text>
          </Show>
        </box>
      </Show>
      <Show when={step() === "adding"}>
        <Spinner>Adding domain...</Spinner>
      </Show>
      <Show when={step() === "done"}>
        <box flexDirection="column" gap={1}>
          <box flexDirection="row" gap={1}>
            <text fg={theme.success}>{"✓"}</text>
            <text fg={theme.text}>Domain configured</text>
          </box>
          <text fg={theme.text} attributes={TextAttributes.UNDERLINE}>
            http://{addedDomain()}
          </text>
          <text fg={theme.secondary} attributes={TextAttributes.UNDERLINE}>
            https://{addedDomain()}
          </text>
          <text fg={theme.textMuted}>
            SSL certificate may take a few minutes to provision.
          </text>
        </box>
      </Show>
      <text fg={theme.textMuted}>
        {step() === "subdomain"
          ? "Enter to continue, Esc to cancel"
          : step() === "project"
          ? "Type to filter, ↑↓ navigate, Enter to select"
          : step() === "done"
          ? "Press Enter or Esc to close"
          : ""}
      </text>
    </box>
  )
}

function ConfirmRemove(props: {
  subdomain: string
  baseDomain: string
  config: ResolvedConfig
  onDone: () => void
}) {
  const dialog = useDialog()
  const toast = useToast()
  const [removing, setRemoving] = createSignal(false)
  const [confirmSelected, setConfirmSelected] = createSignal(1)

  useKeyboard((evt) => {
    if (removing()) return

    if (evt.name === "left" || evt.name === "h") {
      setConfirmSelected(0)
      evt.preventDefault()
    }
    if (evt.name === "right" || evt.name === "l") {
      setConfirmSelected(1)
      evt.preventDefault()
    }
    if (evt.name === "return") {
      evt.preventDefault()
      if (confirmSelected() === 0) {
        handleRemove()
      } else {
        dialog.clear()
      }
    }
  })

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeDomain(props.config, props.subdomain, "")
      toast.show({
        variant: "success",
        message: `${props.subdomain}.${props.baseDomain} removed`,
      })
      dialog.clear()
      props.onDone()
    } catch (err) {
      toast.error(err)
      setRemoving(false)
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Remove Domain
      </text>
      <text fg={theme.text}>
        Remove {props.subdomain}.{props.baseDomain}?
      </text>
      <Show
        when={!removing()}
        fallback={<Spinner>Removing...</Spinner>}
      >
        <box flexDirection="row" gap={2}>
          <text
            fg={confirmSelected() === 0 ? theme.error : theme.textMuted}
            attributes={confirmSelected() === 0 ? TextAttributes.BOLD : undefined}
          >
            [Yes]
          </text>
          <text
            fg={confirmSelected() === 1 ? theme.text : theme.textMuted}
            attributes={confirmSelected() === 1 ? TextAttributes.BOLD : undefined}
          >
            [No]
          </text>
        </box>
      </Show>
    </box>
  )
}
