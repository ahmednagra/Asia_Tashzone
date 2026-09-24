import { Vibration } from "react-native";

export type SoundCue = "cardPlay" | "cardLift" | "trickSweep" | "trumpBreak" | "victory" | "bhabhi" | "tap";

export function triggerSound(cue: SoundCue, enabled = true, hapticsEnabled = true, strength: "off" | "gentle" | "crisp" | "firm" = "crisp") {
  if (!enabled && !hapticsEnabled) return;
  if (!hapticsEnabled || strength === "off") return;

  const mult = strength === "gentle" ? 0.6 : strength === "firm" ? 1.5 : 1;

  switch (cue) {
    case "cardLift":
      Vibration.vibrate(Math.round(8 * mult));
      break;
    case "cardPlay":
      Vibration.vibrate(Math.round(18 * mult));
      break;
    case "trickSweep":
      Vibration.vibrate([0, Math.round(15 * mult), 40, Math.round(25 * mult)]);
      break;
    case "trumpBreak":
      Vibration.vibrate([0, Math.round(30 * mult), 60, Math.round(50 * mult)]);
      break;
    case "victory":
      Vibration.vibrate([0, Math.round(30 * mult), 80, Math.round(40 * mult), 80, Math.round(60 * mult)]);
      break;
    case "bhabhi":
      Vibration.vibrate([0, Math.round(50 * mult), 100, Math.round(50 * mult), 100, Math.round(70 * mult)]);
      break;
    case "tap":
    default:
      Vibration.vibrate(Math.round(10 * mult));
      break;
  }
}
