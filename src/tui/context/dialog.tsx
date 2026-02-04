import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import {
  createContext,
  createSignal,
  useContext,
  type JSX,
  type ParentProps,
  Show,
} from "solid-js"
import { theme } from "../theme"
import { RGBA } from "@opentui/core"

interface DialogEntry {
  element: JSX.Element | (() => JSX.Element)
  onClose?: () => void
}

const [dialogEntry, setDialogEntry] = createSignal<DialogEntry | null>(null)

function createDialogActions() {
  return {
    replace(element: JSX.Element | (() => JSX.Element), onClose?: () => void) {
      setDialogEntry({ element, onClose })
    },
    clear() {
      const entry = dialogEntry()
      entry?.onClose?.()
      setDialogEntry(null)
    },
    get isOpen() {
      return dialogEntry() !== null
    },
    get stack() {
      const entry = dialogEntry()
      return entry ? [entry] : []
    },
  }
}

export type DialogContext = ReturnType<typeof createDialogActions>

const ctx = createContext<DialogContext>()

function DialogOverlay(props: { onClose: () => void; children: JSX.Element }) {
  const dimensions = useTerminalDimensions()
  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      alignItems="center"
      position="absolute"
      zIndex={9999}
      paddingTop={Math.floor(dimensions().height / 4)}
      left={0}
      top={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
    >
      <box
        width={60}
        maxWidth={dimensions().width - 4}
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        borderColor={theme.border}
        border={true}
      >
        {props.children}
      </box>
    </box>
  )
}

export function DialogProvider(props: ParentProps) {
  const value = createDialogActions()

  useKeyboard((evt) => {
    if (evt.name === "escape" && dialogEntry()) {
      value.clear()
      evt.preventDefault()
      evt.stopPropagation()
    }
  })

  return (
    <ctx.Provider value={value}>
      {props.children}
      <Show when={dialogEntry()}>
        {(entry) => (
          <DialogOverlay onClose={() => value.clear()}>
            {entry().element as JSX.Element}
          </DialogOverlay>
        )}
      </Show>
    </ctx.Provider>
  )
}

export function useDialog() {
  const value = useContext(ctx)
  if (!value)
    throw new Error("useDialog must be used within a DialogProvider")
  return value
}
