import { For } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"

const LOGO_LINES = [
  "  ██████╗██████╗  █████╗ ███████╗████████╗███████╗██████╗ ███████╗",
  " ██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗██╔════╝",
  " ██║     ██████╔╝███████║█████╗     ██║   █████╗  ██████╔╝███████╗",
  " ██║     ██╔══██╗██╔══██║██╔══╝     ██║   ██╔══╝  ██╔══██╗╚════██║",
  " ╚██████╗██║  ██║██║  ██║██║        ██║   ███████╗██║  ██║███████║",
  "  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝",
]

const TAGLINE = "Domain management & Claude Code configuration"

export function Logo() {
  return (
    <box alignItems="center">
      <box>
        <For each={LOGO_LINES}>
          {(line) => (
            <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
              {line}
            </text>
          )}
        </For>
      </box>
      <text fg={theme.textMuted} marginTop={1} selectable={false}>
        {TAGLINE}
      </text>
    </box>
  )
}
