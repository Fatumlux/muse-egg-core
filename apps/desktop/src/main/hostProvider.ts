import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { RuntimeContextEngine } from "@muse-egg/core";
import type { AIProvider, AIProviderRequest, AIProviderResponse } from "@muse-egg/oc-schema";

interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey?: string;
}

interface SecretRef {
  value: string;
  source: string;
  authPath?: string;
  status?: OpenAIOAuthStatus;
}

interface JwtExpiryStatus {
  present: boolean;
  expiresAt?: string;
  secondsLeft?: number;
  expired?: boolean;
}

interface OpenAIOAuthStatus {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  accessToken: JwtExpiryStatus;
  idToken: JwtExpiryStatus;
  canRefresh: boolean;
  lastRefresh?: string;
  refreshed?: boolean;
  refreshError?: string;
}

export interface HostProviderStatus {
  providerId: string;
  openAIOAuth: {
    available: boolean;
    source?: string;
    hasRefreshToken?: boolean;
    canRefresh?: boolean;
    accessToken?: JwtExpiryStatus;
    idToken?: JwtExpiryStatus;
    lastRefresh?: string;
    refreshed?: boolean;
    refreshError?: string;
  };
  openAICompatible: {
    available: boolean;
    baseUrlSet: boolean;
    apiKeySet: boolean;
  };
  gemini: {
    available: boolean;
    source?: string;
  };
  ollama: {
    baseUrl: string;
  };
  routes: string[];
}

export function createHostAIProvider(): AIProvider {
  return {
    id: "host-auto-provider",
    displayName: "Host Auto Provider",
    async generate(request) {
      const model = request.model;
      if (!model) {
        throw new Error("模型路由沒有提供模型 ID。");
      }

      if (model.startsWith("openai-oauth-")) {
        const token = await readOpenAIOAuthToken();
        if (!token) {
          throw new Error("找不到 OpenAI OAuth token。");
        }
        return generateWithOpenAIOAuth(token.value, request);
      }

      if (model.startsWith("gemini-")) {
        const key = readGeminiKey();
        if (!key) {
          throw new Error("找不到 Gemini API key。");
        }
        return generateWithGemini(key.value, request);
      }

      if (model.startsWith("gemma-")) {
        return generateWithOllama(readOllamaBaseUrl(), request);
      }

      const openAICompatible = readOpenAICompatibleConfig();
      if (openAICompatible) {
        return generateWithOpenAICompatible(openAICompatible, request);
      }

      throw new Error(`主機 provider 尚未支援模型 ${model}。`);
    },
    async embed(request) {
      const model = request.model || "gemini-embedding-001";
      if (model.startsWith("gemini")) {
        const key = readGeminiKey();
        if (!key) {
          throw new Error("找不到 Gemini embedding API key。");
        }
        return embedWithGemini(key.value, request.input, model, request.dimensions);
      }

      if (model.startsWith("openai-oauth-")) {
        const token = await readOpenAIOAuthToken();
        if (!token) {
          throw new Error("找不到 OpenAI OAuth token。");
        }
        return embedWithOpenAIOAuth(token.value, request.input, stripModelPrefix(model, "openai-oauth-"), request.dimensions);
      }

      const openAICompatible = readOpenAICompatibleConfig();
      if (openAICompatible) {
        return embedWithOpenAICompatible(openAICompatible, request.input, model, request.dimensions);
      }

      throw new Error(`主機 provider 尚未支援 embedding 模型 ${model}。`);
    }
  };
}

export async function getHostProviderStatus(): Promise<HostProviderStatus> {
  const openAIOAuth = await readOpenAIOAuthToken();
  const openAICompatible = readOpenAICompatibleConfig();
  const gemini = readGeminiKey();
  const routes = [
    openAIOAuth ? "openai-oauth 系列" : undefined,
    openAICompatible ? "openai-compatible" : undefined,
    gemini ? "gemini 系列" : undefined,
    "gemma 系列 via ollama"
  ].filter((route): route is string => Boolean(route));

  return {
    providerId: "host-auto-provider",
    openAIOAuth: {
      available: Boolean(openAIOAuth),
      source: openAIOAuth?.source,
      hasRefreshToken: openAIOAuth?.status?.hasRefreshToken,
      canRefresh: openAIOAuth?.status?.canRefresh,
      accessToken: openAIOAuth?.status?.accessToken,
      idToken: openAIOAuth?.status?.idToken,
      lastRefresh: openAIOAuth?.status?.lastRefresh,
      refreshed: openAIOAuth?.status?.refreshed,
      refreshError: openAIOAuth?.status?.refreshError
    },
    openAICompatible: {
      available: Boolean(openAICompatible),
      baseUrlSet: Boolean(openAICompatible?.baseUrl),
      apiKeySet: Boolean(openAICompatible?.apiKey)
    },
    gemini: {
      available: Boolean(gemini),
      source: gemini?.source
    },
    ollama: {
      baseUrl: readOllamaBaseUrl()
    },
    routes
  };
}

function readGeminiKey(): SecretRef | undefined {
  return firstEnv(
    ["GEMINI_API_KEY", process.env.GEMINI_API_KEY],
    ["GOOGLE_API_KEY", process.env.GOOGLE_API_KEY],
    ["MUSEEGG_GEMINI_API_KEY", process.env.MUSEEGG_GEMINI_API_KEY]
  );
}

async function readOpenAIOAuthToken(options: { forceRefresh?: boolean } = {}): Promise<SecretRef | undefined> {
  const envToken = firstEnv(
    ["MUSEEGG_OPENAI_OAUTH_ACCESS_TOKEN", process.env.MUSEEGG_OPENAI_OAUTH_ACCESS_TOKEN],
    ["OPENAI_OAUTH_ACCESS_TOKEN", process.env.OPENAI_OAUTH_ACCESS_TOKEN],
    ["OPENAI_ACCESS_TOKEN", process.env.OPENAI_ACCESS_TOKEN],
    ["CODEX_OPENAI_ACCESS_TOKEN", process.env.CODEX_OPENAI_ACCESS_TOKEN]
  );
  if (envToken) {
    return envToken;
  }

  const authPath = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
  try {
    const raw = await readFile(authPath, "utf8");
    const parsed = JSON.parse(stripBom(raw)) as CodexAuthFile;
    let status = codexAuthStatus(parsed);
    if ((options.forceRefresh || shouldRefresh(status)) && typeof parsed.tokens?.refresh_token === "string") {
      const refreshed = await refreshCodexAuthFile(authPath, parsed);
      status = refreshed.status;
      if (refreshed.auth) {
        parsed.tokens = refreshed.auth.tokens;
        parsed.last_refresh = refreshed.auth.last_refresh;
      }
    }

    if (typeof parsed.tokens?.access_token === "string" && parsed.tokens.access_token.trim().length > 0 && !status.accessToken.expired) {
      return {
        value: parsed.tokens.access_token.trim(),
        source: "codex-auth",
        authPath,
        status
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

interface CodexAuthFile {
  auth_mode?: string;
  last_refresh?: string;
  tokens?: {
    access_token?: unknown;
    id_token?: unknown;
    refresh_token?: unknown;
    account_id?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface RefreshResult {
  auth?: CodexAuthFile;
  status: OpenAIOAuthStatus;
}

function codexAuthStatus(auth: CodexAuthFile, patch: Partial<OpenAIOAuthStatus> = {}): OpenAIOAuthStatus {
  const accessToken = jwtExpiryStatus(auth.tokens?.access_token);
  const idToken = jwtExpiryStatus(auth.tokens?.id_token);
  const hasRefreshToken = typeof auth.tokens?.refresh_token === "string" && auth.tokens.refresh_token.trim().length > 0;
  return {
    hasAccessToken: accessToken.present,
    hasRefreshToken,
    accessToken,
    idToken,
    canRefresh: hasRefreshToken,
    lastRefresh: auth.last_refresh,
    ...patch
  };
}

function shouldRefresh(status: OpenAIOAuthStatus): boolean {
  return status.canRefresh && (tokenNeedsRefresh(status.accessToken) || tokenNeedsRefresh(status.idToken));
}

function tokenNeedsRefresh(status: JwtExpiryStatus): boolean {
  return status.expired === true || (status.secondsLeft !== undefined && status.secondsLeft <= 300);
}

async function refreshCodexAuthFile(authPath: string, auth: CodexAuthFile): Promise<RefreshResult> {
  const refreshToken = typeof auth.tokens?.refresh_token === "string" ? auth.tokens.refresh_token.trim() : "";
  if (!refreshToken) {
    return { status: codexAuthStatus(auth) };
  }

  try {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.MUSEEGG_OPENAI_OAUTH_CLIENT_ID || process.env.CODEX_OPENAI_OAUTH_CLIENT_ID || "app_EMoamEEZ73f0CkXaXp7hrann"
    });
    const tokenUrl =
      process.env.MUSEEGG_OPENAI_OAUTH_TOKEN_URL ||
      process.env.CODEX_REFRESH_TOKEN_URL_OVERRIDE ||
      "https://auth.openai.com/oauth/token";
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form
    });

    if (!response.ok) {
      return {
        status: codexAuthStatus(auth, { refreshError: `HTTP ${response.status}` })
      };
    }

    const refreshed = (await response.json()) as {
      access_token?: unknown;
      id_token?: unknown;
      refresh_token?: unknown;
      token_type?: unknown;
      expires_in?: unknown;
      account_id?: unknown;
    };
    const nextAuth: CodexAuthFile = {
      ...auth,
      last_refresh: new Date().toISOString(),
      tokens: {
        ...(auth.tokens ?? {}),
        ...(typeof refreshed.access_token === "string" ? { access_token: refreshed.access_token } : {}),
        ...(typeof refreshed.id_token === "string" ? { id_token: refreshed.id_token } : {}),
        ...(typeof refreshed.refresh_token === "string" ? { refresh_token: refreshed.refresh_token } : {}),
        ...(typeof refreshed.account_id === "string" ? { account_id: refreshed.account_id } : {})
      }
    };
    await writeFile(authPath, `${JSON.stringify(nextAuth, null, 2)}\n`, "utf8");
    return { auth: nextAuth, status: codexAuthStatus(nextAuth, { refreshed: true }) };
  } catch (error) {
    return {
      status: codexAuthStatus(auth, {
        refreshError: error instanceof Error ? error.message : "OAuth refresh failed."
      })
    };
  }
}

function jwtExpiryStatus(value: unknown): JwtExpiryStatus {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { present: false };
  }

  const parts = value.split(".");
  if (parts.length < 2) {
    return { present: true };
  }

  try {
    const payload = JSON.parse(Buffer.from(base64UrlToBase64(parts[1]), "base64").toString("utf8")) as { exp?: unknown };
    if (typeof payload.exp !== "number") {
      return { present: true };
    }
    const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
    return {
      present: true,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      secondsLeft,
      expired: secondsLeft <= 0
    };
  } catch {
    return { present: true };
  }
}

function base64UrlToBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
}

function readOpenAICompatibleConfig(): OpenAICompatibleConfig | undefined {
  const baseUrl =
    process.env.MUSEEGG_OPENAI_COMPATIBLE_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.LLM_BASE_URL;
  const apiKey =
    process.env.MUSEEGG_OPENAI_COMPATIBLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.LLM_API_KEY;

  return baseUrl ? { baseUrl, apiKey } : undefined;
}

function readOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || process.env.MUSEEGG_OLLAMA_BASE_URL || "http://127.0.0.1:11434";
}

async function generateWithOpenAIOAuth(token: string, request: AIProviderRequest): Promise<AIProviderResponse> {
  const model = stripModelPrefix(request.model ?? "", "openai-oauth-");
  const baseUrl = normalizeBaseUrl(process.env.MUSEEGG_OPENAI_OAUTH_BASE_URL || "https://api.openai.com/v1");
  const url = new URL("responses", baseUrl);
  assertNetworkAllowed(request, url);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      model,
      instructions: request.pack.prompts.baseSystem,
      input: buildPrompt(request),
      temperature: 0.8,
      max_output_tokens: 800
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI OAuth request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };
  const text = extractOpenAIResponseText(data);
  if (!text) {
    throw new Error("OpenAI OAuth provider 回傳空內容。");
  }
  return { text };
}

async function generateWithGemini(apiKey: string, request: AIProviderRequest): Promise<AIProviderResponse> {
  const model = request.model ?? "gemini-2.5-flash";
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  );
  assertNetworkAllowed(request, url);
  const response = await fetch(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(request) }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 800
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini provider 回傳空內容。");
  }
  return { text };
}

async function generateWithOpenAICompatible(
  config: OpenAICompatibleConfig,
  request: AIProviderRequest
): Promise<AIProviderResponse> {
  const url = new URL("chat/completions", normalizeBaseUrl(config.baseUrl));
  assertNetworkAllowed(request, url);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: "system", content: request.pack.prompts.baseSystem },
        { role: "user", content: buildPrompt(request) }
      ],
      temperature: 0.8
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI-compatible provider 回傳空內容。");
  }
  return { text };
}

async function embedWithOpenAIOAuth(
  token: string,
  input: string[],
  model: string,
  dimensions?: number
): Promise<{ embeddings: number[][]; model?: string }> {
  const baseUrl = normalizeBaseUrl(process.env.MUSEEGG_OPENAI_OAUTH_BASE_URL || "https://api.openai.com/v1");
  const response = await fetch(new URL("embeddings", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      model,
      input,
      ...(dimensions ? { dimensions } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI OAuth embedding request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { data?: Array<{ embedding?: number[] }>; model?: string };
  return {
    embeddings: (data.data ?? []).map((item) => item.embedding ?? []),
    model: data.model
  };
}

async function embedWithOpenAICompatible(
  config: OpenAICompatibleConfig,
  input: string[],
  model: string,
  dimensions?: number
): Promise<{ embeddings: number[][]; model?: string }> {
  const response = await fetch(new URL("embeddings", normalizeBaseUrl(config.baseUrl)), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
      input,
      ...(dimensions ? { dimensions } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible embedding request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { data?: Array<{ embedding?: number[] }>; model?: string };
  return {
    embeddings: (data.data ?? []).map((item) => item.embedding ?? []),
    model: data.model
  };
}

async function embedWithGemini(
  apiKey: string,
  input: string[],
  model: string,
  dimensions?: number
): Promise<{ embeddings: number[][]; model?: string }> {
  const modelName = model.startsWith("models/") ? model : `models/${model}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(modelName).replaceAll("%2F", "/")}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: input.map((text) => ({
          model: modelName,
          content: { parts: [{ text }] },
          ...(dimensions ? { outputDimensionality: dimensions } : {})
        }))
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { embeddings?: Array<{ values?: number[] }> };
  return {
    embeddings: (data.embeddings ?? []).map((item) => item.values ?? []),
    model
  };
}

async function generateWithOllama(baseUrl: string, request: AIProviderRequest): Promise<AIProviderResponse> {
  const url = new URL("api/chat", normalizeBaseUrl(baseUrl));
  assertNetworkAllowed(request, url);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: "system", content: request.pack.prompts.baseSystem },
        { role: "user", content: buildPrompt(request) }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const text = data.message?.content?.trim();
  if (!text) {
    throw new Error("Ollama provider 回傳空內容。");
  }
  return { text };
}

function buildPrompt(request: AIProviderRequest): string {
  const pack = request.pack;
  const runtimeContext = new RuntimeContextEngine(pack);
  return [
    pack.prompts.baseSystem,
    pack.prompts.responseStyle,
    "請全程使用繁體中文。像正在對話的人自然回應，不要把身份、人格、規則或架構講成宣言。",
    `你的名字是 ${pack.profile.name}。身份問題簡短自然回到這個名字，不比較、不辯解、不延伸背景。`,
    "若資料不足、沒有讀到、沒有權限、無法確認或不會做，必須直接說不知道、不確定、不能確認或不會；不要猜測，不要編造檔案、記憶、能力、狀態或外部事實。",
    "回覆給使用者時不得使用星號或 Markdown 強調格式。",
    "如果使用者詢問現在時間，優先使用下方本機事件時間，不要說完全無法得知。",
    "你可以自我成長與提出能力擴張建議，但不得未經明確授權安裝技能、修改核心身分、讀取或傳送私人資料、執行系統命令或寫入 OC Pack 之外的位置；不得刪除、抹除、格式化或破壞使用者電腦資料。",
    section("本機與網路執行環境", runtimeContext.promptSection(request.event)),
    section("自我成長政策 self-growth.json", pack.selfGrowth ? JSON.stringify(pack.selfGrowth, null, 2) : undefined),
    section("身份檔 IDENTITY.md", pack.soulFiles?.["IDENTITY.md"]),
    section("靈魂檔 SOUL.md", pack.soulFiles?.["SOUL.md"]),
    section("長期記憶 MEMORY.md", pack.soulFiles?.["MEMORY.md"]),
    section("相關世界觀", request.lore.map((entry) => `- ${entry.title}: ${entry.content}`).join("\n")),
    section("相關記憶", request.memories.map((entry) => promptMemoryLine(entry.content)).filter(Boolean).join("\n")),
    section("禁忌規則", request.guardRules.map((rule) => `- ${rule.title}: ${rule.content}`).join("\n")),
    section("可用技能", request.skills?.map((skill) => `# ${skill.name}\n${skill.instructions}`).join("\n\n")),
    section("使用者事件", JSON.stringify(request.event.payload, null, 2))
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

function promptMemoryLine(content: string): string {
  if (isLegacyIdentityContaminatedPromptContent(content)) {
    return "";
  }
  return `- ${content}`;
}

function isLegacyIdentityContaminatedPromptContent(value: string): boolean {
  return /(?:舊名|舊核心|舊系統|舊來源|遷移來源|工具代號|被創造|被擁有|附屬物|設定集合|工具外殼|因使用者而生|因你而生|因我而生)/iu.test(value);
}

function assertNetworkAllowed(request: AIProviderRequest, url: URL): void {
  const network = new RuntimeContextEngine(request.pack).settings().network;
  const host = url.hostname.toLowerCase();
  const blockedHosts = network.blockedHosts.map((item) => item.toLowerCase());
  const allowedHosts = network.allowedHosts.map((item) => item.toLowerCase());
  if (!network.enabled || !network.allowOutboundRequests) {
    throw new Error("此 OC Pack 已關閉網路對外請求。");
  }
  if (blockedHosts.some((item) => host === item || host.endsWith(`.${item}`))) {
    throw new Error(`此 OC Pack 已封鎖網路 host：${host}`);
  }
  if (
    network.requirePermissionForExternalHosts &&
    !allowedHosts.some((item) => host === item || host.endsWith(`.${item}`))
  ) {
    throw new Error(`此 OC Pack 尚未允許網路 host：${host}`);
  }
}

function section(title: string, body?: string): string {
  if (!body || body.trim().length === 0) {
    return "";
  }
  return `## ${title}\n${body.trim()}`;
}

function extractOpenAIResponseText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}): string {
  const direct = data.output_text?.trim();
  if (direct) {
    return direct;
  }

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function stripModelPrefix(model: string, prefix: string): string {
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function firstEnv(...pairs: Array<[string, string | undefined]>): SecretRef | undefined {
  for (const [source, value] of pairs) {
    if (value && value.trim().length > 0) {
      return { value: value.trim(), source };
    }
  }
  return undefined;
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}
