import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, ErrorBoundary } from "solid-js"
import { theme } from "./theme"
import { RouteProvider, useRoute } from "./context/route"
import { ExitProvider, useExit } from "./context/exit"
import { ToastProvider } from "./context/toast"
import { ConfigProvider } from "./context/config"
import { DialogProvider } from "./context/dialog"
import { Home } from "./screens/home"
import { Domains } from "./screens/domains"
import { ClaudeConfig } from "./screens/claude-config"
import { Credentials } from "./screens/credentials"

function App() {
  const route = useRoute()
  const dimensions = useTerminalDimensions()
  const exit = useExit()
  const renderer = useRenderer()

  renderer.setTerminalTitle("Crafters")

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      exit()
      evt.preventDefault()
    }
  })

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
      flexDirection="column"
    >
      <Switch>
        <Match when={route.data.type === "home"}>
          <Home />
        </Match>
        <Match when={route.data.type === "domains"}>
          <Domains />
        </Match>
        <Match when={route.data.type === "claude"}>
          <ClaudeConfig />
        </Match>
        <Match when={route.data.type === "credentials"}>
          <Credentials />
        </Match>
      </Switch>
    </box>
  )
}

function ErrorComponent(props: { error: Error; onExit: () => Promise<void> }) {
  const renderer = useRenderer()

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      renderer.setTerminalTitle("")
      renderer.destroy()
      props.onExit()
    }
  })

  return (
    <box flexDirection="column" gap={1} padding={2}>
      <text fg={theme.error}>A fatal error occurred!</text>
      <text fg={theme.textMuted}>{props.error.message}</text>
      <text fg={theme.textMuted}>Press Ctrl+C to exit</text>
    </box>
  )
}

export function launchTUI() {
  return new Promise<void>(async (resolve) => {
    const onExit = async () => {
      resolve()
    }

    render(
      () => (
        <ErrorBoundary
          fallback={(error) => (
            <ErrorComponent error={error} onExit={onExit} />
          )}
        >
          <ExitProvider onExit={onExit}>
            <ToastProvider>
              <ConfigProvider>
                <RouteProvider>
                  <DialogProvider>
                    <App />
                  </DialogProvider>
                </RouteProvider>
              </ConfigProvider>
            </ToastProvider>
          </ExitProvider>
        </ErrorBoundary>
      ),
      {
        targetFps: 60,
        exitOnCtrlC: false,
      }
    )
  })
}
