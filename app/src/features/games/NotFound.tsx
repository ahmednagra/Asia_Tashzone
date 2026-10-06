import React from "react";
import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { T } from "./copy";

export function GameNotFound({ title = T.detail.notFound, body = T.detail.notFoundBody }: { title?: string; body?: string }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Screen footer={<GoldButton label={T.detail.back} onPress={() => router.replace("/games")} />}>
      <Header title={title} />
      <GlassCard>
        <Text style={[s.body, { color: c.textSecondary }]}>{body}</Text>
      </GlassCard>
    </Screen>
  );
}
const s = StyleSheet.create({ body: { fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 21 } });
