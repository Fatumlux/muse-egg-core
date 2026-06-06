import type { OCAutonomySettings, OCEvent } from "@muse-egg/oc-schema";

export interface AutonomyDecision {
  allowed: boolean;
  multiplier: number;
  reasons: string[];
}

export class AutonomyEngine {
  constructor(private readonly settings: OCAutonomySettings) {}

  evaluate(event: OCEvent, wakeupsToday: number, now = new Date()): AutonomyDecision {
    const reasons: string[] = [];

    if (!this.settings.enabled) {
      return { allowed: false, multiplier: 0, reasons: ["autonomy_disabled"] };
    }

    if (!this.eventIsEnabled(event)) {
      return { allowed: false, multiplier: 0, reasons: ["event_channel_disabled"] };
    }

    if (this.isQuietHour(now)) {
      reasons.push("quiet_hours");
    }

    if (wakeupsToday >= this.settings.maxWakeupsPerDay) {
      return { allowed: false, multiplier: 0, reasons: ["daily_wakeup_limit"] };
    }

    return {
      allowed: reasons.length === 0,
      multiplier: this.frequencyMultiplier(),
      reasons
    };
  }

  private eventIsEnabled(event: OCEvent): boolean {
    if (event.type === "telegram_message") {
      return this.settings.wakeOnTelegramMessage;
    }
    if (event.type === "observed_file_change" || event.platform === "file_watcher") {
      return this.settings.wakeOnFileChange;
    }
    if (event.type.startsWith("scheduled_")) {
      return this.settings.wakeOnScheduledCheck;
    }
    return true;
  }

  private frequencyMultiplier(): number {
    if (this.settings.wakeFrequency === "low") {
      return 0.75;
    }
    if (this.settings.wakeFrequency === "high") {
      return 1.25;
    }
    return 1;
  }

  private isQuietHour(now: Date): boolean {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const start = parseClock(this.settings.quietHours.start);
    const end = parseClock(this.settings.quietHours.end);

    if (start === end) {
      return false;
    }
    if (start < end) {
      return currentMinutes >= start && currentMinutes < end;
    }
    return currentMinutes >= start || currentMinutes < end;
  }
}

function parseClock(value: string): number {
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}
