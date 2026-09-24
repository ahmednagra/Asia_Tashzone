import { account, adoptToken, ApiFailure, freshGuest, hasAccount, online, signOut } from "../multiplayer/http";
import { type Provider, type ProviderCredential, deviceProviders, providerCredential } from "../../services/googleAuth";
import { readToken } from "../../services/session";
import type { Profile } from "../../store/profileModel";
import type { SessionView } from "../../types/api";
import { fromServer, toProgress } from "./progressSync";
import { normalizeEmail } from "./validate";

export interface AccountState {
  email: string | null;
  linked: Provider[];
  providers: Provider[];
  emailAccounts: boolean;
}

export type LinkResult = { kind: "linked" } | { kind: "taken"; provider: Provider; credential: ProviderCredential };

const nameOf = (p: Profile) => p.name.trim() || "Player";
const known = (list: string[] | undefined) => (list ?? []).filter((p): p is Provider => p === "google" || p === "play_games");

export async function accountState(profile: Profile): Promise<AccountState> {
  const cfg = await online.appConfig().catch(() => null);
  const linking = cfg?.features?.account_linking !== false;
  const serverProviders = linking ? known(cfg?.sign_in_providers) : [];
  const providers = deviceProviders().filter((p) => serverProviders.includes(p));
  const base = { providers, emailAccounts: !!cfg?.email_accounts };
  if (!(await hasAccount())) return { ...base, email: null, linked: [] };
  const me = await account.me(nameOf(profile));
  return { ...base, email: me.email, linked: known(me.linked_providers) };
}

async function pullProfile(session: SessionView, current: Profile): Promise<Profile> {
  await adoptToken(session.token);
  const name = nameOf(current);
  const [me, progress] = await Promise.all([account.me(name), account.progress(name)]);
  return fromServer(me, progress, current);
}

export async function pushProfile(profile: Profile): Promise<void> {
  const name = nameOf(profile);
  await account.updateMe(name, { display_name: name, avatar_id: profile.avatar });
  await account.putProgress(name, toProgress(profile.stats));
}

export function requestCode(email: string, purpose: "signup" | "login" | "reset", lang: string) {
  return account.requestCode(normalizeEmail(email), purpose, lang);
}

export async function createAccount(email: string, code: string, password: string, profile: Profile): Promise<void> {
  const name = nameOf(profile);
  if (!profile.protectedMode && (await hasAccount()) && (await account.me(name)).protected) await freshGuest(name);
  const session = await account.signup(name, normalizeEmail(email), code, password);
  await adoptToken(session.token);
  await pushProfile(profile).catch(() => {});
}

export async function signInWithPassword(email: string, password: string, current: Profile): Promise<Profile> {
  return pullProfile(await account.login(normalizeEmail(email), password), current);
}

export async function signInWithCode(email: string, code: string, current: Profile): Promise<Profile> {
  return pullProfile(await account.loginCode(normalizeEmail(email), code), current);
}

export async function resetPassword(email: string, code: string, password: string, current: Profile): Promise<Profile> {
  return pullProfile(await account.resetPassword(normalizeEmail(email), code, password), current);
}

export async function changePassword(current: string, next: string, profile: Profile): Promise<void> {
  const session = await account.changePassword(nameOf(profile), current, next);
  await adoptToken(session.token);
}

export async function signOutEverywhere(profile: Profile): Promise<void> {
  const session = await account.signOutEverywhere(nameOf(profile));
  await adoptToken(session.token);
}

export async function listDevices(profile: Profile) {
  return (await account.sessions(nameOf(profile))).sessions;
}

export function signOutDevice(id: string, profile: Profile): Promise<void> {
  return account.endSession(nameOf(profile), id);
}

export async function signOutHere(): Promise<void> {
  await signOut();
}

export async function linkProvider(provider: Provider, profile: Profile): Promise<LinkResult> {
  const credential = await providerCredential(provider);
  try {
    await account.link(nameOf(profile), credential);
  } catch (e) {
    if (e instanceof ApiFailure && e.code === "IDENTITY_ALREADY_LINKED") return { kind: "taken", provider, credential };
    throw e;
  }
  const token = await readToken();
  if (token) await adoptToken(token);
  await pushProfile(profile).catch(() => {});
  return { kind: "linked" };
}

export async function switchToLinked(taken: Extract<LinkResult, { kind: "taken" }>, current: Profile): Promise<Profile> {
  const credential = taken.provider === "google" ? taken.credential : await providerCredential(taken.provider);
  return pullProfile(await account.restore(credential), current);
}

export function unlinkProvider(provider: Provider, profile: Profile): Promise<void> {
  return account.unlink(nameOf(profile), provider);
}
