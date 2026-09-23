/** Build-time config. EXPO_PUBLIC_* variables are inlined by Expo; never put secrets here. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000";
export const VERSION_CODE = 1;
