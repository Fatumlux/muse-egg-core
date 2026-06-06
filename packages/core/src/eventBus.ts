import type { OCEvent } from "@muse-egg/oc-schema";

export type OCEventListener = (event: OCEvent) => void | Promise<void>;

export class EventBus {
  private listeners = new Map<string, Set<OCEventListener>>();
  private allListeners = new Set<OCEventListener>();
  private events: OCEvent[] = [];

  on(eventType: string, listener: OCEventListener): () => void {
    const bucket = this.listeners.get(eventType) ?? new Set<OCEventListener>();
    bucket.add(listener);
    this.listeners.set(eventType, bucket);
    return () => this.off(eventType, listener);
  }

  onAny(listener: OCEventListener): () => void {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  off(eventType: string, listener: OCEventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  async emit(event: OCEvent): Promise<void> {
    this.events.unshift(event);
    this.events = this.events.slice(0, 500);

    const listeners = [
      ...(this.listeners.get(event.type) ?? []),
      ...this.allListeners
    ];

    await Promise.all(listeners.map((listener) => listener(event)));
  }

  history(limit = 100): OCEvent[] {
    return this.events.slice(0, limit);
  }
}
