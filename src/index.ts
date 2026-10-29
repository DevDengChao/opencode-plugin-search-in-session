import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "opencode-plugin-search-in-session",
  setup(ctx) {
    console.info(`[search-in-session] server part loaded in OpenCode ${ctx.app.version}`)
  },
})
