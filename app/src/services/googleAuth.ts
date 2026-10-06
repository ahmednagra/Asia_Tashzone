import * as Crypto from "expo-crypto";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { GOOGLE_WEB_CLIENT_ID } from "../lib/env";

export type Provider = "google" | "play_games";
export interface ProviderCredential { provider: Provider; idToken: string; nonce?: string }
export type SignInErrorCode = "CANCELLED" | "NO_ACCOUNT" | "NOT_CONFIGURED" | "NO_ACTIVITY" | "FAILED";

interface NativeGoogleAuth {
  isPlayGamesReady(): boolean;
  googleIdToken(webClientId: string, nonce: string): Promise<string>;
  playGamesServerCode(serverClientId: string): Promise<string>;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<NativeGoogleAuth>("TzGoogleAuth") : null;
const CODES: readonly SignInErrorCode[] = ["CANCELLED", "NO_ACCOUNT", "NOT_CONFIGURED", "NO_ACTIVITY"];

export class SignInError extends Error {
  constructor(readonly code: SignInErrorCode) { super(code); }
}

export function deviceProviders(): Provider[] {
  if (!native || !GOOGLE_WEB_CLIENT_ID) return [];
  return native.isPlayGamesReady() ? ["google", "play_games"] : ["google"];
}

export async function providerCredential(provider: Provider): Promise<ProviderCredential> {
  if (!native || !GOOGLE_WEB_CLIENT_ID) throw new SignInError("NOT_CONFIGURED");
  try {
    if (provider === "google") {
      const nonce = Crypto.randomUUID();
      return { provider, idToken: await native.googleIdToken(GOOGLE_WEB_CLIENT_ID, nonce), nonce };
    }
    return { provider, idToken: await native.playGamesServerCode(GOOGLE_WEB_CLIENT_ID) };
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new SignInError(CODES.includes(code as SignInErrorCode) ? (code as SignInErrorCode) : "FAILED");
  }
}
