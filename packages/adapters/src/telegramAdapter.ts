import type { PlatformRouter } from "@muse-egg/core";

export interface TelegramAdapterSettings {
  enabled: boolean;
  botToken?: string;
  allowedUserIds: number[];
  allowedChatIds: number[];
  pollingIntervalMs?: number;
  botUsername?: string;
  mentionPatterns?: string[];
  requireMentionInGroups?: boolean;
  ignoreBotMessages?: boolean;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      is_bot?: boolean;
    };
    reply_to_message?: {
      from?: {
        id: number;
        username?: string;
        is_bot?: boolean;
      };
    };
  };
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export interface TelegramAdapterStatus {
  running: boolean;
  offset: number;
  botUsername?: string;
  webhookCleared?: boolean;
  lastPollStartedAt?: string;
  lastPollAt?: string;
  lastUpdateAt?: string;
  lastHandledAt?: string;
  lastSentAt?: string;
  lastTypingAt?: string;
  lastError?: string;
  lastIgnoredReason?: string;
  polledUpdates: number;
  pollAttempts: number;
  handledMessages: number;
  sentMessages: number;
  typingActions: number;
  ignoredMessages: number;
}

export class TelegramAdapter {
  private running = false;
  private offset = 0;
  private loopPromise?: Promise<void>;
  private readonly runtimeStatus: TelegramAdapterStatus = {
    running: false,
    offset: 0,
    polledUpdates: 0,
    pollAttempts: 0,
    handledMessages: 0,
    sentMessages: 0,
    typingActions: 0,
    ignoredMessages: 0
  };

  constructor(
    private readonly settings: TelegramAdapterSettings,
    private readonly router: PlatformRouter
  ) {}

  start(): void {
    if (!this.settings.enabled || !this.settings.botToken) {
      return;
    }
    if (this.running) {
      return;
    }

    this.running = true;
    this.runtimeStatus.running = true;
    this.loopPromise = this.pollLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.runtimeStatus.running = false;
    await this.loopPromise;
  }

  isRunning(): boolean {
    return this.running;
  }

  status(): TelegramAdapterStatus {
    return { ...this.runtimeStatus, running: this.running, offset: this.offset };
  }

  private async pollLoop(): Promise<void> {
    await this.preparePolling();

    while (this.running) {
      try {
        this.runtimeStatus.lastPollStartedAt = new Date().toISOString();
        this.runtimeStatus.pollAttempts += 1;
        const updates = await this.getUpdates();
        this.runtimeStatus.lastPollAt = new Date().toISOString();
        this.runtimeStatus.polledUpdates += updates.length;
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          this.runtimeStatus.offset = this.offset;
          this.runtimeStatus.lastUpdateAt = new Date().toISOString();
          await this.handleUpdate(update);
        }
      } catch (error) {
        this.runtimeStatus.lastError = error instanceof Error ? error.message : "Telegram polling failed.";
        await delay(this.settings.pollingIntervalMs ?? 1800);
      }

      await delay(this.settings.pollingIntervalMs ?? 1200);
    }
  }

  private async preparePolling(): Promise<void> {
    try {
      const me = await this.callApi<{ username?: string }>("getMe", {});
      this.runtimeStatus.botUsername = me.username;
      if (!this.settings.botUsername && me.username) {
        this.settings.botUsername = me.username;
      }
      await this.callApi("deleteWebhook", { drop_pending_updates: false });
      this.runtimeStatus.webhookCleared = true;
    } catch (error) {
      this.runtimeStatus.lastError = error instanceof Error ? error.message : "Telegram prepare failed.";
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    return this.callApi<TelegramUpdate[]>("getUpdates", {
      offset: this.offset,
      timeout: 10,
      allowed_updates: ["message"]
    });
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text) {
      this.ignore("no_text_message");
      return;
    }

    const allowed = this.allowedState(message.chat.id, message.from?.id);
    if (!allowed.allowed) {
      this.ignore(allowed.reason);
      return;
    }

    const gate = this.responseGate(message);
    if (!gate.allowed) {
      this.ignore(gate.reason);
      return;
    }

    await this.sendTyping(message.chat.id);
    const typingTimer = setInterval(() => {
      void this.sendTyping(message.chat.id);
    }, 4000);

    let routed;
    try {
      routed = await this.router.receive({
        type: "telegram_message",
        platform: "telegram",
        source: "telegram_polling",
        payload: {
          text: message.text,
          chatId: message.chat.id,
          messageId: message.message_id,
          userId: message.from?.id,
          username: message.from?.username,
          firstName: message.from?.first_name
        }
      });
    } finally {
      clearInterval(typingTimer);
    }

    const text = this.router.routeToTelegram(routed);
    if (text) {
      await this.sendMessage(message.chat.id, text);
      this.runtimeStatus.handledMessages += 1;
      this.runtimeStatus.lastHandledAt = new Date().toISOString();
      return;
    }

    this.ignore("core_returned_no_telegram_text");
  }

  private allowedState(chatId: number, userId?: number): { allowed: boolean; reason: string } {
    const chatAllowed =
      this.settings.allowedChatIds.length === 0 || this.settings.allowedChatIds.includes(chatId);
    const userAllowed =
      userId === undefined ||
      this.settings.allowedUserIds.length === 0 ||
      this.settings.allowedUserIds.includes(userId);
    return {
      allowed: chatAllowed && userAllowed,
      reason: !chatAllowed ? "chat_not_allowed" : !userAllowed ? "user_not_allowed" : "allowed"
    };
  }

  private responseGate(message: NonNullable<TelegramUpdate["message"]>): { allowed: boolean; reason: string } {
    if (this.settings.ignoreBotMessages !== false && message.from?.is_bot) {
      return { allowed: false, reason: "from_bot" };
    }

    if (!isGroupChat(message.chat.type) || this.settings.requireMentionInGroups === false) {
      return { allowed: true, reason: "private_or_group_gate_off" };
    }

    const text = (message.text ?? "").toLowerCase();
    const patterns = this.mentionPatterns();
    const mentioned = patterns.some((pattern) => text.includes(pattern.toLowerCase()));
    const repliedToBot =
      Boolean(message.reply_to_message?.from?.is_bot) &&
      patterns.some((pattern) => pattern.replace(/^@/u, "").toLowerCase() === message.reply_to_message?.from?.username?.toLowerCase());

    return {
      allowed: mentioned || repliedToBot,
      reason: mentioned ? "mentioned" : repliedToBot ? "reply_to_bot" : "group_without_mention"
    };
  }

  private mentionPatterns(): string[] {
    const configured = this.settings.mentionPatterns?.filter((pattern) => pattern.trim().length > 0) ?? [];
    const username = this.settings.botUsername?.trim();
    return Array.from(new Set([...configured, ...(username ? [`@${username.replace(/^@/u, "")}`] : [])]));
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    await this.callApi("sendMessage", {
      chat_id: chatId,
      text
    });
    this.runtimeStatus.sentMessages += 1;
    this.runtimeStatus.lastSentAt = new Date().toISOString();
  }

  private async sendTyping(chatId: number): Promise<void> {
    try {
      await this.callApi("sendChatAction", {
        chat_id: chatId,
        action: "typing"
      });
      this.runtimeStatus.typingActions += 1;
      this.runtimeStatus.lastTypingAt = new Date().toISOString();
    } catch (error) {
      this.runtimeStatus.lastError = error instanceof Error ? error.message : "Telegram typing action failed.";
    }
  }

  private async callApi<T = unknown>(method: string, body: unknown): Promise<T> {
    const response = await fetch(this.apiUrl(method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await response.json()) as TelegramResponse<T>;
    if (!data.ok) {
      throw new Error(data.description ?? `Telegram ${method} failed.`);
    }
    return data.result;
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.settings.botToken}/${method}`;
  }

  private ignore(reason: string): void {
    this.runtimeStatus.ignoredMessages += 1;
    this.runtimeStatus.lastIgnoredReason = reason;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGroupChat(type: string): boolean {
  return type === "group" || type === "supergroup" || type === "channel";
}
