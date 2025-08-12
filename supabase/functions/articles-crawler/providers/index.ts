/**
 * Provider exports for easy importing
 */

import { TelegrafiProvider } from "./telegrafi.ts";
import { InsajderiProvider } from "./insajderi.ts";

export { TelegrafiProvider } from "./telegrafi.ts";
export { InsajderiProvider } from "./insajderi.ts";

// Provider registry for easy management
export const AVAILABLE_PROVIDERS = {
  telegrafi: TelegrafiProvider,
  insajderi: InsajderiProvider,
} as const;

export type ProviderName = keyof typeof AVAILABLE_PROVIDERS;