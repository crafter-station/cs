import { RGBA } from "@opentui/core"
import { colors } from "../ui/colors"

export type Theme = {
  [K in keyof typeof colors]: RGBA
}

export const theme: Theme = Object.fromEntries(
  Object.entries(colors).map(([key, value]) => [key, RGBA.fromHex(value)])
) as Theme
