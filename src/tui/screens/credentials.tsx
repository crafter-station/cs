import { createSignal, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"
import { useRoute } from "../context/route"
import { useToast } from "../context/toast"
import { useConfig } from "../context/config"
import { useDialog } from "../context/dialog"
import { Toast } from "../components/toast"
import { Spinner } from "../components/spinner"
import { saveConfig, getConfigPath } from "../../lib/config"

export function Credentials() {
  const route = useRoute()
  const toast = useToast()
  const cfg = useConfig()
  const dialog = useDialog()

  useKeyboard((evt) => {
    if (dialog.isOpen) return

    if (evt.name === "escape") {
      route.navigate({ type: "home" })
      evt.preventDefault()
      return
    }

    if (evt.name === "l" && cfg.isLoggedIn) {
      evt.preventDefault()
      dialog.replace(() => <ConfirmLogout />)
      return
    }

    if (evt.name === "a" && !cfg.isLoggedIn) {
      evt.preventDefault()
      dialog.replace(() => <LoginForm />)
      return
    }
  })

  return (
    <>
      <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <box flexDirection="row" marginBottom={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Credentials
          </text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>
            {cfg.isLoggedIn ? "l:logout" : "a:login"}  esc:back
          </text>
        </box>

        <Show when={cfg.loading}>
          <Spinner>Loading config...</Spinner>
        </Show>

        <Show when={!cfg.loading && cfg.isLoggedIn && cfg.config}>
          <box flexDirection="column" gap={0} marginBottom={1}>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Base Domain:</text>
              <text fg={theme.secondary}>{cfg.config!.baseDomain}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Spaceship Key:</text>
              <text fg={theme.text}>
                {cfg.config!.spaceship.apiKey.slice(0, 8)}...
              </text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Vercel Token:</text>
              <text fg={theme.text}>
                {cfg.config!.vercel.token.slice(0, 8)}...
              </text>
            </box>
            <Show when={cfg.config!.vercel.teamId}>
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>Vercel Team:</text>
                <text fg={theme.text}>{cfg.config!.vercel.teamId}</text>
              </box>
            </Show>
          </box>
          <text fg={theme.textMuted}>Config: {getConfigPath()}</text>
        </Show>

        <Show when={!cfg.loading && !cfg.isLoggedIn}>
          <text fg={theme.warning}>
            Not logged in. Press 'a' to add credentials.
          </text>
        </Show>
      </box>
      <Toast />
    </>
  )
}

function ConfirmLogout() {
  const dialog = useDialog()
  const toast = useToast()
  const cfg = useConfig()
  const [removing, setRemoving] = createSignal(false)
  const [sel, setSel] = createSignal(1)

  useKeyboard((evt) => {
    if (removing()) return
    if (evt.name === "left" || evt.name === "h") {
      setSel(0)
      evt.preventDefault()
    }
    if (evt.name === "right" || evt.name === "l") {
      setSel(1)
      evt.preventDefault()
    }
    if (evt.name === "return") {
      evt.preventDefault()
      if (sel() === 0) {
        handleLogout()
      } else {
        dialog.clear()
      }
    }
  })

  async function handleLogout() {
    setRemoving(true)
    try {
      const fs = await import("fs/promises")
      await fs.unlink(getConfigPath())
      toast.show({ variant: "success", message: "Credentials removed" })
      await cfg.reload()
      dialog.clear()
    } catch {
      toast.show({ variant: "warning", message: "No credentials found" })
      dialog.clear()
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Logout
      </text>
      <text fg={theme.text}>Remove stored credentials?</text>
      <Show when={!removing()} fallback={<Spinner>Removing...</Spinner>}>
        <box flexDirection="row" gap={2}>
          <text
            fg={sel() === 0 ? theme.error : theme.textMuted}
            attributes={sel() === 0 ? TextAttributes.BOLD : undefined}
          >
            [Yes]
          </text>
          <text
            fg={sel() === 1 ? theme.text : theme.textMuted}
            attributes={sel() === 1 ? TextAttributes.BOLD : undefined}
          >
            [No]
          </text>
        </box>
      </Show>
    </box>
  )
}

function LoginForm() {
  const dialog = useDialog()
  const toast = useToast()
  const cfg = useConfig()

  const fields = [
    { key: "spaceshipKey", label: "Spaceship API Key" },
    { key: "spaceshipSecret", label: "Spaceship API Secret" },
    { key: "vercelToken", label: "Vercel Token" },
    { key: "vercelTeamId", label: "Vercel Team ID (optional)" },
    { key: "baseDomain", label: "Base Domain" },
  ] as const

  const [values, setValues] = createSignal<Record<string, string>>({
    baseDomain: "crafter.run",
  })
  const [fieldIndex, setFieldIndex] = createSignal(0)
  const [saving, setSaving] = createSignal(false)

  const currentField = () => fields[fieldIndex()]

  useKeyboard((evt) => {
    if (saving()) return

    if (evt.name === "return") {
      evt.preventDefault()
      if (fieldIndex() < fields.length - 1) {
        setFieldIndex((i) => i + 1)
      } else {
        handleSave()
      }
      return
    }

    if (evt.name === "backspace") {
      evt.preventDefault()
      const key = currentField().key
      const val = values()[key] || ""
      if (val.length === 0 && fieldIndex() > 0) {
        setFieldIndex((i) => i - 1)
      } else {
        setValues((v) => ({ ...v, [key]: val.slice(0, -1) }))
      }
      return
    }

    if (evt.name.length === 1 && !evt.ctrl && !evt.meta) {
      evt.preventDefault()
      const key = currentField().key
      setValues((v) => ({ ...v, [key]: (v[key] || "") + evt.name }))
    }
  })

  async function handleSave() {
    const v = values()
    if (!v.spaceshipKey || !v.spaceshipSecret || !v.vercelToken) {
      toast.show({ variant: "error", message: "Key, secret, and token are required" })
      return
    }

    setSaving(true)
    try {
      await saveConfig({
        spaceship: { apiKey: v.spaceshipKey, apiSecret: v.spaceshipSecret },
        vercel: { token: v.vercelToken, teamId: v.vercelTeamId },
        baseDomain: v.baseDomain || "crafter.run",
      })
      toast.show({ variant: "success", message: "Credentials saved" })
      await cfg.reload()
      dialog.clear()
    } catch (err) {
      toast.error(err)
      setSaving(false)
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Login
      </text>
      {fields.map((field, i) => (
        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted}>{field.label}:</text>
          <Show when={i <= fieldIndex()}>
            <text fg={i === fieldIndex() ? theme.primary : theme.text}>
              {(values()[field.key] || "") + (i === fieldIndex() ? "▌" : "")}
            </text>
          </Show>
        </box>
      ))}
      <Show when={saving()}>
        <Spinner>Saving...</Spinner>
      </Show>
      <text fg={theme.textMuted}>Enter to continue, Esc to cancel</text>
    </box>
  )
}
