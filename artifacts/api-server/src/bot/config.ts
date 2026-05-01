import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, "../../data");
const CONFIG_FILE = join(CONFIG_DIR, "guild-config.json");

export interface GuildConfig {
  welcomeChannelId?: string;
  backgroundUrl?: string;
  welcomeMessage?: string;
  embedColor?: string;
}

type ConfigStore = Record<string, GuildConfig>;

function loadStore(): ConfigStore {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, "{}", "utf-8");
    return {};
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as ConfigStore;
  } catch {
    return {};
  }
}

function saveStore(store: ConfigStore): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function getGuildConfig(guildId: string): GuildConfig {
  const store = loadStore();
  return store[guildId] ?? {};
}

export function setGuildConfig(guildId: string, patch: Partial<GuildConfig>): GuildConfig {
  const store = loadStore();
  store[guildId] = { ...(store[guildId] ?? {}), ...patch };
  saveStore(store);
  return store[guildId]!;
}
