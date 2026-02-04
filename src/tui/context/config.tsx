import { createSignal } from "solid-js"
import { loadConfig, type CraftersConfig } from "../../lib/config"
import { createSimpleContext } from "./helper"

export const { use: useConfig, provider: ConfigProvider } = createSimpleContext({
  name: "Config",
  init: () => {
    const [config, setConfig] = createSignal<CraftersConfig | null>(null)
    const [loading, setLoading] = createSignal(true)

    async function reload() {
      setLoading(true)
      const c = await loadConfig()
      setConfig(c)
      setLoading(false)
    }

    reload()

    return {
      get config() {
        return config()
      },
      get loading() {
        return loading()
      },
      get isLoggedIn() {
        return config() !== null
      },
      reload,
    }
  },
})
