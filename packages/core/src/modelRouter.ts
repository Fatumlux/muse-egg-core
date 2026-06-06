import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  OCModelRouting
} from "@muse-egg/oc-schema";

export interface ModelAttempt {
  model?: string;
  ok: boolean;
  error?: string;
}

export interface RoutedModelResponse {
  response: AIProviderResponse;
  model?: string;
  providerId: string;
  fallbackUsed: boolean;
  attempts: ModelAttempt[];
}

export class ModelRouter {
  constructor(
    private readonly provider: AIProvider | undefined,
    private readonly routing: OCModelRouting | undefined
  ) {}

  async generate(request: AIProviderRequest): Promise<RoutedModelResponse | undefined> {
    if (!this.provider) {
      return undefined;
    }

    const models = this.models();
    const attempts: ModelAttempt[] = [];
    const retryPerModel = Math.max(1, this.routing?.retryPerModel ?? 1);

    for (const [index, model] of models.entries()) {
      for (let attempt = 0; attempt < retryPerModel; attempt += 1) {
        try {
          const response = await this.withTimeout(
            this.provider.generate({ ...request, model }),
            this.routing?.timeoutMs ?? 30_000
          );
          if (response.text.trim().length === 0) {
            throw new Error("Provider returned an empty response.");
          }

          attempts.push({ model, ok: true });
          return {
            response,
            model,
            providerId: this.provider.id,
            fallbackUsed: index > 0,
            attempts
          };
        } catch (error) {
          attempts.push({
            model,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown provider error."
          });
        }
      }
    }

    return undefined;
  }

  private models(): Array<string | undefined> {
    if (!this.routing?.enabled) {
      return [undefined];
    }

    return [this.routing.primaryModel, ...this.routing.fallbackModels].filter((model) => model.length > 0);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error(`Provider timed out after ${timeoutMs}ms.`)), timeoutMs);
        })
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
