import { createContext, useContext, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"

export interface ToastOptions {
  title?: string
  message: string
  variant: "info" | "success" | "warning" | "error"
  duration?: number
}

function init() {
  const [store, setStore] = createStore({
    currentToast: null as ToastOptions | null,
  })

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const toast = {
    show(options: ToastOptions) {
      const { duration = 5000, ...currentToast } = options
      setStore("currentToast", currentToast)
      if (timeoutHandle) clearTimeout(timeoutHandle)
      timeoutHandle = setTimeout(() => {
        setStore("currentToast", null)
      }, duration)
    },
    error(err: unknown) {
      if (err instanceof Error)
        return toast.show({ variant: "error", message: err.message })
      toast.show({ variant: "error", message: "An unknown error has occurred" })
    },
    get currentToast(): ToastOptions | null {
      return store.currentToast
    },
  }
  return toast
}

export type ToastContext = ReturnType<typeof init>

const ctx = createContext<ToastContext>()

export function ToastProvider(props: ParentProps) {
  const value = init()
  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

export function useToast() {
  const value = useContext(ctx)
  if (!value) throw new Error("useToast must be used within a ToastProvider")
  return value
}
