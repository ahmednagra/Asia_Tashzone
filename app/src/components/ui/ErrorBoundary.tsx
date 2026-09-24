import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, themes } from "../../theme/tokens";

interface Props { children: React.ReactNode; onReset?: () => void; where?: string }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) console.error("ErrorBoundary", error, info.componentStack);
  }
  private reset = () => { this.setState({ error: null }); this.props.onReset?.(); };
  render() {
    if (!this.state.error) return this.props.children;
    const c = themes.emerald.c;
    return (
      <View style={[s.root, { backgroundColor: c.bg }]} accessibilityRole="alert">
        <Text style={[s.title, { color: c.text }]}>Something went wrong{this.props.where ? ` in ${this.props.where}` : ""}.</Text>
        <Text style={[s.body, { color: c.textSecondary }]}>Your profile and settings are safe. Try again, and if it keeps happening, restart the app.</Text>
        <Pressable accessibilityRole="button" onPress={this.reset} style={[s.btn, { backgroundColor: c.primary }]}>
          <Text style={[s.btnText, { color: c.onPrimary }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontFamily: fonts.display.family, fontSize: 26, textAlign: "center" },
  body: { fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  btn: { minHeight: 44, paddingHorizontal: 22, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontFamily: fonts.ui.semibold, fontSize: 15 },
});
