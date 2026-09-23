import { useRouter, type Href } from "expo-router";

/** Route navigation with a string href (routes are typed at build time; data-driven hrefs, e.g. the atlas, are plain strings). */
export function useGo() {
  const router = useRouter();
  return (href: string) => router.push(href as Href);
}
