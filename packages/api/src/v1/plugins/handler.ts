import { auth } from "@nonete/auth"

export const pluginsHandler = {
  list: async () => {
    return (auth.options.plugins ?? []).map((plugin) => ({ id: plugin.id }))
  },
}
