import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";

/** Android hardware back runs `action` instead of popping the screen (iOS has no such button; screens keep an on-screen control too). */
export function useBackAction(action: () => void, enabled = true): void {
  const ref = useRef(action);
  ref.current = action;
  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { ref.current(); return true; });
    return () => sub.remove();
  }, [enabled]);
}
