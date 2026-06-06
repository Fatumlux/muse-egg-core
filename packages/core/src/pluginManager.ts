import type { AIProvider, OCEvent, OCPack } from "@muse-egg/oc-schema";

export interface MuseEggPlugin {
  id: string;
  name: string;
  onPackLoaded?(pack: OCPack): void | Promise<void>;
  onEvent?(event: OCEvent, pack: OCPack): void | Promise<void>;
}

export class PluginManager {
  private plugins = new Map<string, MuseEggPlugin>();
  private aiProviders = new Map<string, AIProvider>();

  registerPlugin(plugin: MuseEggPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  registerAIProvider(provider: AIProvider): void {
    this.aiProviders.set(provider.id, provider);
  }

  getAIProvider(id: string): AIProvider | undefined {
    return this.aiProviders.get(id);
  }

  listPlugins(): MuseEggPlugin[] {
    return [...this.plugins.values()];
  }

  listAIProviders(): AIProvider[] {
    return [...this.aiProviders.values()];
  }

  async notifyPackLoaded(pack: OCPack): Promise<void> {
    await Promise.all([...this.plugins.values()].map((plugin) => plugin.onPackLoaded?.(pack)));
  }

  async notifyEvent(event: OCEvent, pack: OCPack): Promise<void> {
    await Promise.all([...this.plugins.values()].map((plugin) => plugin.onEvent?.(event, pack)));
  }
}
