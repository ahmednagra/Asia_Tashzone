interface ImportMeta {
  glob(patterns: string | string[], options: { eager: true }): Record<string, unknown>;
}
