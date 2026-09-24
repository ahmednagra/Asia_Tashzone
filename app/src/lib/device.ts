import { Platform } from "react-native";

const MAX = 60;

function androidName(): string {
  const c = Platform.constants as { Brand?: string; Manufacturer?: string; Model?: string };
  const brand = (c.Brand ?? c.Manufacturer ?? "").trim();
  const model = (c.Model ?? "").trim();
  const title = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "";
  if (!model) return title || "Android";
  return model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${title} ${model}`.trim();
}

export const DEVICE_NAME = (Platform.OS === "android" ? androidName() : Platform.OS).replace(/[^\x20-\x7E]/g, "").trim().slice(0, MAX);
