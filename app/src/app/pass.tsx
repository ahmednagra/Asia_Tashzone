import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PassCurtain } from "../features/multiplayer/PassCurtain";

/** /pass?name=Sana&next=/play/callbreak — `next` (an in-app path) replaces this screen when the named player taps. */
export default function Route() {
  const { name, next } = useLocalSearchParams<{ name?: string; next?: string }>();
  const router = useRouter();
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return <PassCurtain name={name ?? ""} onReady={() => (target ? router.replace(target as never) : router.back())} />;
}
