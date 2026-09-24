import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export type SessionKind = "guest" | "account";

const KEY = "tashzone.session.v1";
const KIND_KEY = "tashzone.session.kind.v1";
const LEGACY_KEY = "tashzone.online.account.v1";

let cached: { token: string | null; kind: SessionKind } | undefined;

async function load(): Promise<{ token: string | null; kind: SessionKind }> {
  if (cached) return cached;
  let token = await SecureStore.getItemAsync(KEY).catch(() => null);
  const kind: SessionKind = (await SecureStore.getItemAsync(KIND_KEY).catch(() => null)) === "account" ? "account" : "guest";
  if (!token) {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY).catch(() => null);
    if (legacy) {
      token = legacy;
      await SecureStore.setItemAsync(KEY, legacy).then(() => AsyncStorage.removeItem(LEGACY_KEY)).catch(() => {});
    }
  }
  cached = { token: token ?? null, kind };
  return cached;
}

export async function readToken(): Promise<string | null> {
  return (await load()).token;
}

export async function sessionKind(): Promise<SessionKind> {
  return (await load()).kind;
}

export async function writeToken(token: string, kind: SessionKind): Promise<void> {
  cached = { token, kind };
  await SecureStore.setItemAsync(KEY, token);
  await SecureStore.setItemAsync(KIND_KEY, kind);
}

export async function clearToken(): Promise<void> {
  cached = { token: null, kind: "guest" };
  await Promise.all([
    SecureStore.deleteItemAsync(KEY).catch(() => {}),
    SecureStore.deleteItemAsync(KIND_KEY).catch(() => {}),
    AsyncStorage.removeItem(LEGACY_KEY).catch(() => {}),
  ]);
}
