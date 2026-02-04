import { createSignal, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"
import { useRoute } from "../context/route"
import { useToast } from "../context/toast"
import { Spinner } from "../components/spinner"
import { Toast } from "../components/toast"
import { Menu, type MenuItem } from "../components/menu"
import { installClaudeDx, exists, getClaudeDxPath } from "../../lib/claude-ops"

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Install",
    description: "Clone and install Claude DX config (skip existing)",
    value: "install",
  },
  {
    label: "Update",
    description: "Pull latest and overwrite all config",
    value: "update",
  },
]

export function ClaudeConfig() {
  const route = useRoute()
  const toast = useToast()

  const [busy, setBusy] = createSignal(false)
  const [installed, setInstalled] = createSignal<boolean | null>(null)

  exists(getClaudeDxPath()).then(setInstalled)

  useKeyboard((evt) => {
    if (busy()) return

    if (evt.name === "escape") {
      route.navigate({ type: "home" })
      evt.preventDefault()
    }
  })

  async function handleSelect(item: MenuItem) {
    if (busy()) return
    setBusy(true)

    try {
      const force = item.value === "update"
      const result = await installClaudeDx(force)

      const parts: string[] = []
      if (result.commands.copied.length > 0)
        parts.push(`${result.commands.copied.length} commands`)
      if (result.agents.length > 0)
        parts.push(`${result.agents.length} agents`)
      if (result.skills.length > 0)
        parts.push(`${result.skills.length} skills`)

      toast.show({
        variant: "success",
        title: force ? "Updated" : "Installed",
        message: parts.length > 0 ? parts.join(", ") : "Nothing new to install",
      })
      setInstalled(true)
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <box flexDirection="row" marginBottom={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Claude Code Configuration
          </text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>esc:back</text>
        </box>

        <box marginBottom={1}>
          <Show when={installed() !== null}>
            <text fg={installed() ? theme.success : theme.warning}>
              {installed()
                ? "claude-dx is installed"
                : "claude-dx is not installed"}
            </text>
          </Show>
        </box>

        <Show
          when={!busy()}
          fallback={<Spinner>Working...</Spinner>}
        >
          <Menu items={MENU_ITEMS} onSelect={handleSelect} />
        </Show>
      </box>
      <Toast />
    </>
  )
}
