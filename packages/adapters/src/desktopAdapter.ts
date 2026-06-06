import type { PlatformRouter } from "@muse-egg/core";
import type { PlatformMessage } from "@muse-egg/core";

export class DesktopAdapter {
  constructor(private readonly router: PlatformRouter) {}

  sendUserMessage(text: string): Promise<PlatformMessage | undefined> {
    return this.router.receive({
      type: "user_message",
      platform: "desktop",
      source: "desktop_console",
      payload: { text }
    });
  }

  dispatchCustomEvent(payload: Record<string, unknown>): Promise<PlatformMessage | undefined> {
    return this.router.receive({
      type: "custom_event",
      platform: "desktop",
      source: "desktop_console",
      payload
    });
  }
}
