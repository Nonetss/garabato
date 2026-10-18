import { type Context, getRequestLogger } from "#context"
import { APP_VERSION, newerRelease, releaseFeed } from "#shared/releases"

export const releaseHandler = {
  status: async ({ context }: { context: Context }) => {
    // Only administrators can update, so only they look GitHub up.
    if (context.user?.role !== "admin") {
      return { current: APP_VERSION, update: null }
    }
    const latest = await releaseFeed.latest((error) => {
      getRequestLogger(context)?.warn(
        { err: error },
        "Could not look up the latest release"
      )
    })
    return { current: APP_VERSION, update: newerRelease(APP_VERSION, latest) }
  },
}
