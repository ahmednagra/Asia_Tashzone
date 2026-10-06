import { useKeepAwake } from "expo-keep-awake";

export function KeepAwake(): null {
  useKeepAwake("tashzone-table");
  return null;
}
