import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import type { AIProvider, OCMemoryEntry, OCPack } from "@muse-egg/oc-schema";

interface ChunkRow {
  id: string;
  path: string;
  source: string;
  start_line: number;
  end_line: number;
  hash: string;
  model: string;
  text: string;
  embedding: string;
  updated_at: number;
  distance?: number;
}

interface EmbeddingOptions {
  provider?: AIProvider;
}

export class SQLiteVecMemoryStore {
  private db: Database.Database | undefined;
  private readonly dimensions: number;
  private readonly embeddingModel: string;

  constructor(private readonly pack: OCPack) {
    this.dimensions = Math.max(1, pack.memoryStore?.dimensions ?? 3072);
    this.embeddingModel = pack.memoryStore?.embeddingModel || "gemini-embedding-001";
    this.db = this.openDatabase();
  }

  available(): boolean {
    return Boolean(this.db);
  }

  async upsertMemory(entry: OCMemoryEntry, options: EmbeddingOptions = {}): Promise<void> {
    if (!this.db) {
      return;
    }

    const text = entry.content.trim();
    if (!text) {
      return;
    }

    const vector = await this.embedText(text, options);
    const vectorJson = JSON.stringify(vector);
    const path = `runtime/${entry.timestamp.slice(0, 10)}.jsonl`;
    const source = entry.type === "note" ? "memory" : entry.type;
    const hash = createHash("sha256").update(text).digest("hex");
    const updatedAt = Date.parse(entry.timestamp) || Date.now();

    const write = this.db.transaction(() => {
      this.db
        ?.prepare(
          `insert or replace into chunks
            (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
           values
            (@id, @path, @source, @start_line, @end_line, @hash, @model, @text, @embedding, @updated_at)`
        )
        .run({
          id: entry.id,
          path,
          source,
          start_line: 1,
          end_line: Math.max(1, text.split(/\r?\n/g).length),
          hash,
          model: this.embeddingModel,
          text,
          embedding: vectorJson,
          updated_at: updatedAt
        });

      this.db?.prepare("delete from chunks_fts where id = ?").run(entry.id);
      this.db
        ?.prepare(
          `insert into chunks_fts
            (text, id, path, source, model, start_line, end_line)
           values (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(text, entry.id, path, source, this.embeddingModel, 1, Math.max(1, text.split(/\r?\n/g).length));

      this.db?.prepare("delete from chunks_vec where id = ?").run(entry.id);
      this.db?.prepare("insert into chunks_vec(id, embedding) values (?, ?)").run(entry.id, vectorJson);

      this.db
        ?.prepare("insert or replace into files(path, source, hash, mtime, size) values (?, ?, ?, ?, ?)")
        .run(path, source, hash, updatedAt, Buffer.byteLength(text, "utf8"));
    });

    write();
  }

  async search(text: string, limit = 8, options: EmbeddingOptions = {}): Promise<OCMemoryEntry[]> {
    if (!this.db || text.trim().length === 0) {
      return [];
    }

    const vectorMatches = await this.searchVector(text, limit, options);
    const ftsMatches = this.searchFts(text, limit);
    const likeMatches = this.searchLike(text, limit);
    return mergeRows([vectorMatches, ftsMatches, likeMatches].flat()).slice(0, limit).map(rowToMemory);
  }

  private openDatabase(): Database.Database | undefined {
    if (!this.pack.path || this.pack.memoryStore?.enabled === false) {
      return undefined;
    }

    try {
      const dbPath = resolve(this.pack.path, this.pack.memoryStore?.databasePath ?? ".museegg/memory/main.sqlite");
      mkdirSync(dirname(dbPath), { recursive: true });
      const db = new Database(dbPath);
      sqliteVec.load(db);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      this.ensureSchema(db);
      return db;
    } catch {
      return undefined;
    }
  }

  private ensureSchema(db: Database.Database): void {
    db.exec(`
      create table if not exists chunks (
        id text primary key,
        path text not null,
        source text not null default 'memory',
        start_line integer not null,
        end_line integer not null,
        hash text not null,
        model text not null,
        text text not null,
        embedding text not null,
        updated_at integer not null
      );

      create virtual table if not exists chunks_fts using fts5(
        text,
        id unindexed,
        path unindexed,
        source unindexed,
        model unindexed,
        start_line unindexed,
        end_line unindexed
      );

      create virtual table if not exists chunks_vec using vec0(
        id text primary key,
        embedding float[${this.dimensions}]
      );

      create table if not exists files (
        path text primary key,
        source text not null default 'memory',
        hash text not null,
        mtime integer not null,
        size integer not null
      );

      create table if not exists meta (
        key text primary key,
        value text not null
      );
    `);

    db.prepare("insert or ignore into meta(key, value) values (?, ?)").run(
      "memory_index_meta_v1",
      JSON.stringify({
        model: this.embeddingModel,
        provider: this.embeddingModel.startsWith("gemini") ? "gemini" : "local",
        sources: ["memory"],
        chunkTokens: 400,
        chunkOverlap: 80,
        ftsTokenizer: "unicode61",
        vectorDims: this.dimensions
      })
    );
  }

  private async searchVector(text: string, limit: number, options: EmbeddingOptions): Promise<ChunkRow[]> {
    if (!this.db) {
      return [];
    }

    try {
      const vectorJson = JSON.stringify(await this.embedText(text, options));
      return this.db
        .prepare(
          `select
            chunks.id,
            chunks.path,
            chunks.source,
            chunks.start_line,
            chunks.end_line,
            chunks.hash,
            chunks.model,
            chunks.text,
            chunks.embedding,
            chunks.updated_at,
            chunks_vec.distance
           from chunks_vec
           join chunks on chunks.id = chunks_vec.id
           where chunks_vec.embedding match ? and k = ?
           order by chunks_vec.distance`
        )
        .all(vectorJson, limit) as ChunkRow[];
    } catch {
      return [];
    }
  }

  private searchFts(text: string, limit: number): ChunkRow[] {
    if (!this.db || this.pack.memoryStore?.useFtsFallback === false) {
      return [];
    }

    const query = buildFtsQuery(text);
    if (!query) {
      return [];
    }

    try {
      return this.db
        .prepare(
          `select
            chunks.id,
            chunks.path,
            chunks.source,
            chunks.start_line,
            chunks.end_line,
            chunks.hash,
            chunks.model,
            chunks.text,
            chunks.embedding,
            chunks.updated_at
           from chunks_fts
           join chunks on chunks.id = chunks_fts.id
           where chunks_fts match ?
           order by rank
           limit ?`
        )
        .all(query, limit) as ChunkRow[];
    } catch {
      return [];
    }
  }

  private searchLike(text: string, limit: number): ChunkRow[] {
    if (!this.db || this.pack.memoryStore?.useFtsFallback === false) {
      return [];
    }

    const terms = searchableTerms(text).slice(0, 4);
    if (terms.length === 0) {
      return [];
    }

    try {
      return this.db
        .prepare(
          `select
            id,
            path,
            source,
            start_line,
            end_line,
            hash,
            model,
            text,
            embedding,
            updated_at
           from chunks
           where ${terms.map((_term, index) => `lower(text) like @term${index}`).join(" or ")}
           order by updated_at desc
           limit @limit`
        )
        .all(Object.fromEntries([...terms.map((term, index) => [`term${index}`, `%${term.toLowerCase()}%`]), ["limit", limit]])) as ChunkRow[];
    } catch {
      return [];
    }
  }

  private async embedText(text: string, options: EmbeddingOptions): Promise<number[]> {
    try {
      const response = await options.provider?.embed?.({
        input: [text],
        model: this.embeddingModel,
        dimensions: this.dimensions
      });
      const vector = response?.embeddings[0];
      if (Array.isArray(vector) && vector.length > 0) {
        return normalizeDimensions(vector, this.dimensions);
      }
    } catch {
      // A local deterministic embedding keeps memory writes available offline.
    }

    return hashEmbedding(text, this.dimensions);
  }
}

function rowToMemory(row: ChunkRow): OCMemoryEntry {
  return {
    id: row.id,
    type: "note",
    content: sanitizeImportedIdentityText(row.text),
    timestamp: new Date(row.updated_at).toISOString(),
    importance: row.distance === undefined ? 70 : Math.max(45, Math.round(90 - row.distance * 20)),
    tags: Array.from(new Set([row.source, row.path, row.model, "sqlite-vec"]))
  };
}

function sanitizeImportedIdentityText(value: string): string {
  return value.replaceAll(String.fromCharCode(42), "").trim();
}

function mergeRows(rows: ChunkRow[]): ChunkRow[] {
  const byId = new Map<string, ChunkRow>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }
    const existingDistance = existing.distance ?? Number.POSITIVE_INFINITY;
    const nextDistance = row.distance ?? Number.POSITIVE_INFINITY;
    if (nextDistance < existingDistance || row.updated_at > existing.updated_at) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const distance = (a.distance ?? 999) - (b.distance ?? 999);
    return Math.abs(distance) > 0.0001 ? distance : b.updated_at - a.updated_at;
  });
}

function normalizeDimensions(vector: number[], dimensions: number): number[] {
  const normalized = vector.slice(0, dimensions).map((value) => Number(value) || 0);
  while (normalized.length < dimensions) {
    normalized.push(0);
  }
  return normalized;
}

function hashEmbedding(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const term of embeddingTerms(text)) {
    const digest = createHash("sha256").update(term).digest();
    const index = digest.readUInt32BE(0) % dimensions;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const length = Math.sqrt(vector.reduce((total, value) => total + value * value, 0)) || 1;
  return vector.map((value) => value / length);
}

function buildFtsQuery(text: string): string {
  return searchableTerms(text)
    .slice(0, 8)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" OR ");
}

function searchableTerms(text: string): string[] {
  return Array.from(new Set(embeddingTerms(text).filter((term) => term.length >= 2)));
}

function embeddingTerms(text: string): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const terms = normalized
    .split(/[^\p{Letter}\p{Number}_@.-]+/gu)
    .map((term) => term.trim())
    .filter(Boolean);

  const compact = normalized.replace(/\s+/g, "");
  for (let index = 0; index < compact.length - 1; index += 1) {
    terms.push(compact.slice(index, index + 2));
  }

  return terms;
}
