import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export type Route =
  | { type: "home" }
  | { type: "domains" }
  | { type: "claude" }
  | { type: "credentials" }

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [store, setStore] = createStore<Route>({ type: "home" })

    return {
      get data() {
        return store
      },
      navigate(route: Route) {
        setStore(route)
      },
    }
  },
})
