import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { useToast } from "../context/toast"
import { theme } from "../theme"
import { SplitBorder } from "./border"

const variantColor = {
  info: theme.info,
  success: theme.success,
  warning: theme.warning,
  error: theme.error,
} as const

export function Toast() {
  const toast = useToast()
  const dimensions = useTerminalDimensions()

  return (
    <Show when={toast.currentToast}>
      {(current) => (
        <box
          position="absolute"
          justifyContent="center"
          alignItems="flex-start"
          top={2}
          right={2}
          maxWidth={Math.min(60, dimensions().width - 6)}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={theme.backgroundPanel}
          borderColor={variantColor[current().variant]}
          border={["left", "right"]}
          customBorderChars={SplitBorder.customBorderChars}
        >
          <Show when={current().title}>
            <text
              attributes={TextAttributes.BOLD}
              marginBottom={1}
              fg={theme.text}
            >
              {current().title}
            </text>
          </Show>
          <text fg={theme.text} wrapMode="word" width="100%">
            {current().message}
          </text>
        </box>
      )}
    </Show>
  )
}
