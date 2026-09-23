import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

interface KeypadProps {
  /** number of digits to collect (4 for the parent PIN, table PINs use the same) */
  digits: number;
  /** called once with the full code */
  onComplete: (code: string) => void;
  /** show dots instead of the digits (PINs); false shows the digits (room codes) */
  masked?: boolean;
  /** ignore presses (locked out, or a check is running) */
  disabled?: boolean;
  /** clear the entry right after onComplete (default); false keeps it until ⌫ is pressed */
  clearOnComplete?: boolean;
  /** what the entry is for, used in the spoken description of the display */
  label?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;

/** Numeric keypad with a digit display (mockup `.pinbox` + `.keypad`). Keys are 64 dp, well above the 44 dp minimum. */
export function Keypad({ digits, onComplete, masked = true, disabled, clearOnComplete = true, label = "Code" }: KeypadProps) {
  const { c, name } = useTheme();
  const dark = name === "dark";
  const [value, setValue] = useState("");

  const press = useCallback((k: string) => {
    if (disabled) return;
    if (k === "⌫") { setValue((v) => v.slice(0, -1)); return; }
    if (value.length >= digits) return;
    const next = value + k;
    if (next.length === digits) {
      setValue(clearOnComplete ? "" : next);
      onComplete(next);
    } else setValue(next);
  }, [disabled, value, digits, clearOnComplete, onComplete]);

  return (
    <View style={s.wrap}>
      <View style={s.boxes} accessible accessibilityLabel={`${label}, ${value.length} of ${digits} digits entered`}>
        {Array.from({ length: digits }, (_, i) => (
          <View key={i} style={[s.box, { borderColor: i === value.length ? material.goldLeaf : dark ? material.lineHard : c.borderControl, backgroundColor: dark ? material.glass : c.surface }]}>
            <Text style={[s.boxText, { color: c.text }]}>{i < value.length ? (masked ? "•" : value[i]) : ""}</Text>
          </View>
        ))}
      </View>
      <View style={s.pad}>
        {KEYS.map((k, i) =>
          k ? (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === "⌫" ? "Delete" : k} accessibilityState={{ disabled: !!disabled }} onPress={() => press(k)}
              style={({ pressed }) => [s.key, { borderWidth: 1, borderColor: dark ? material.line : c.borderControl, backgroundColor: dark ? material.glass : c.surface, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
              <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
            </Pressable>
          ) : <View key={`gap${i}`} style={s.key} />,
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: 20 },
  boxes: { flexDirection: "row", gap: 10 },
  box: { width: 52, height: 60, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  boxText: { fontFamily: fonts.display.family, fontSize: 30, fontWeight: "600" },
  pad: { flexDirection: "row", flexWrap: "wrap", width: 3 * 64 + 2 * 12, gap: 12 },
  key: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: fonts.ui.family, fontSize: 26, fontWeight: "500" },
});
