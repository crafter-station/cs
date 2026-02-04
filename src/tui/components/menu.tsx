import { For, createSignal } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { theme } from "../theme"

export interface MenuItem {
  label: string
  description: string
  value: string
}

export function Menu(props: {
  items: MenuItem[]
  onSelect: (item: MenuItem) => void
}) {
  const [selected, setSelected] = createSignal(0)

  useKeyboard((evt) => {
    if (evt.name === "up" || (evt.name === "k" && !evt.ctrl)) {
      setSelected((i) => (i > 0 ? i - 1 : props.items.length - 1))
      evt.preventDefault()
    }
    if (evt.name === "down" || (evt.name === "j" && !evt.ctrl)) {
      setSelected((i) => (i < props.items.length - 1 ? i + 1 : 0))
      evt.preventDefault()
    }
    if (evt.name === "return") {
      props.onSelect(props.items[selected()])
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column" gap={0}>
      <For each={props.items}>
        {(item, index) => {
          const isSelected = () => index() === selected()
          return (
            <box
              flexDirection="row"
              gap={1}
              paddingLeft={2}
              paddingRight={2}
              paddingTop={0}
              paddingBottom={0}
              backgroundColor={isSelected() ? theme.backgroundElement : undefined}
            >
              <text
                fg={isSelected() ? theme.primary : theme.textMuted}
                attributes={isSelected() ? TextAttributes.BOLD : undefined}
              >
                {isSelected() ? ">" : " "}
              </text>
              <text
                fg={isSelected() ? theme.text : theme.textMuted}
                attributes={isSelected() ? TextAttributes.BOLD : undefined}
              >
                {item.label}
              </text>
              <text fg={theme.textMuted}>
                {item.description}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}
