import { useKeyboard } from "@opentui/solid"
import { theme } from "../theme"
import { useRoute } from "../context/route"
import { useExit } from "../context/exit"
import { Logo } from "../components/logo"
import { Menu, type MenuItem } from "../components/menu"
import { Toast } from "../components/toast"
import { getConfigPath } from "../../lib/config"

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Domains",
    description: "Manage crafter.run subdomains",
    value: "domains",
  },
  {
    label: "Claude Config",
    description: "Install/update Claude Code configuration",
    value: "claude",
  },
  {
    label: "Credentials",
    description: "View or change login credentials",
    value: "credentials",
  },
  {
    label: "Exit",
    description: "Quit the application",
    value: "exit",
  },
]

export function Home() {
  const route = useRoute()
  const exit = useExit()

  useKeyboard((evt) => {
    if (evt.name === "q" && !evt.ctrl) {
      exit()
      evt.preventDefault()
    }
  })

  function handleSelect(item: MenuItem) {
    switch (item.value) {
      case "domains":
        route.navigate({ type: "domains" })
        break
      case "claude":
        route.navigate({ type: "claude" })
        break
      case "credentials":
        route.navigate({ type: "credentials" })
        break
      case "exit":
        exit()
        break
    }
  }

  return (
    <>
      <box
        flexGrow={1}
        justifyContent="center"
        alignItems="center"
        paddingLeft={2}
        paddingRight={2}
        gap={2}
      >
        <Logo />
        <box width="100%" maxWidth={60} paddingTop={1}>
          <Menu items={MENU_ITEMS} onSelect={handleSelect} />
        </box>
      </box>
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        flexDirection="row"
        flexShrink={0}
      >
        <text fg={theme.textMuted}>{getConfigPath()}</text>
        <box flexGrow={1} />
        <text fg={theme.textMuted}>v0.2.2</text>
      </box>
      <Toast />
    </>
  )
}
