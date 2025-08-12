/**
 * Provider exports for easy importing
 */

import { TelegrafiProvider } from "./telegrafi.ts";
import { InsajderiProvider } from "./insajderi.ts";
import { GazetaExpressProvider } from "./gazeta-express.ts";

export { TelegrafiProvider } from "./telegrafi.ts";
export { InsajderiProvider } from "./insajderi.ts";
export { GazetaExpressProvider } from "./gazeta-express.ts";

// Provider registry for easy management
export const AVAILABLE_PROVIDERS = {
  telegrafi: TelegrafiProvider,
  insajderi: InsajderiProvider,
  "gazeta-express": GazetaExpressProvider,
} as const;

export type ProviderName = keyof typeof AVAILABLE_PROVIDERS;