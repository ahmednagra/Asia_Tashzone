/** Environment configuration; secrets are checked at start (C-17): ≥ 32 characters and distinct. */
export interface Config {
  readonly port: number;
  readonly joinTokenSecret: string;
  readonly internalApiToken: string;
  readonly seedEncryptionKey: string; // 64 hex chars (AES-256-GCM), seeds encrypted until seal (T-18)
  readonly apiInternalUrl: string | null;
  readonly databaseUrl: string | null;
  readonly instanceId: string;
  readonly instanceUrl: string;
  readonly drainDeadlineMs: number;
  readonly seedWaitMs: number;
  readonly botDelayMs: number;
  readonly interHandMs: number;
  readonly leaseMs: number;
  readonly renewMs: number;
  readonly marginMs: number;
  /** tests only: override profile turn/window durations */
  readonly turnMsOverride: number | null;
  readonly windowMsOverride: number | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const need = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`missing ${k}`);
    return v;
  };
  const num = (k: string, d: number) => (env[k] ? Number.parseInt(env[k]!, 10) : d);
  const cfg: Config = {
    port: num("PORT", 8787),
    joinTokenSecret: need("JOIN_TOKEN_SECRET"),
    internalApiToken: need("INTERNAL_API_TOKEN"),
    seedEncryptionKey: need("SEED_ENCRYPTION_KEY"),
    apiInternalUrl: env.API_INTERNAL_URL ?? null,
    databaseUrl: env.DATABASE_URL ?? null,
    instanceId: env.INSTANCE_ID ?? "ms-1",
    instanceUrl: env.INSTANCE_URL ?? "",
    drainDeadlineMs: num("DRAIN_DEADLINE_MS", 600_000),
    seedWaitMs: num("SEED_WAIT_MS", 5000),
    botDelayMs: num("BOT_DELAY_MS", 700),
    interHandMs: num("INTER_HAND_MS", 3000),
    leaseMs: num("LEASE_MS", 30_000),
    renewMs: num("RENEW_MS", 10_000),
    marginMs: num("LEASE_MARGIN_MS", 10_000),
    turnMsOverride: env.TURN_MS_OVERRIDE ? Number.parseInt(env.TURN_MS_OVERRIDE, 10) : null,
    windowMsOverride: env.WINDOW_MS_OVERRIDE ? Number.parseInt(env.WINDOW_MS_OVERRIDE, 10) : null,
  };
  checkSecrets(cfg);
  return cfg;
}

export function checkSecrets(cfg: Pick<Config, "joinTokenSecret" | "internalApiToken" | "seedEncryptionKey">): void {
  const secrets = [cfg.joinTokenSecret, cfg.internalApiToken];
  for (const s of secrets) if (s.length < 32) throw new Error("secret shorter than 32 characters");
  if (new Set(secrets).size !== secrets.length) throw new Error("secrets must be distinct");
  if (!/^[0-9a-f]{64}$/.test(cfg.seedEncryptionKey)) throw new Error("SEED_ENCRYPTION_KEY must be 64 hex chars");
}
