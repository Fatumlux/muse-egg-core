import type { AwakeningResult, OCEvent, OCPlatform, OCProcessResult } from "@muse-egg/oc-schema";
import type { OCEngine } from "./ocEngine.js";
import type { OCEventInput } from "./utils.js";

export interface PlatformMessage {
  platform: OCPlatform;
  text: string;
  expression: string;
  eventId: string;
  awakening: AwakeningResult;
}

export class PlatformRouter {
  constructor(private readonly engine: OCEngine) {}

  async receive(input: OCEventInput): Promise<PlatformMessage | undefined> {
    const result = await this.engine.processEvent(input);
    return this.toPlatformMessage(result);
  }

  toPlatformMessage(result: OCProcessResult): PlatformMessage | undefined {
    if (!result.response && !result.awakening.shouldWake) {
      return undefined;
    }

    const response = result.response;
    return {
      platform: response?.platform ?? result.event.platform,
      text: response?.text ?? result.awakening.dialogue ?? "",
      expression: response?.expression ?? result.awakening.expression ?? "neutral",
      eventId: result.event.id,
      awakening: result.awakening
    };
  }

  routeToTelegram(message: PlatformMessage | undefined): string | undefined {
    if (!message || message.platform !== "telegram") {
      return undefined;
    }
    return message.text;
  }
}
