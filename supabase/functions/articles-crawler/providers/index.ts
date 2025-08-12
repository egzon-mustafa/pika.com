/**
 * Provider exports for easy importing
 */

import { TelegrafiProvider } from "./telegrafi.ts";
import { InsajderiProvider } from "./insajderi.ts";
import { GazetaExpressProvider } from "./gazeta-express.ts";
import { GazetaBlicProvider } from "./gazeta-blic.ts";

// Provider registry for easy management
export const AVAILABLE_PROVIDERS = {
  telegrafi: TelegrafiProvider,
  insajderi: InsajderiProvider,
  "gazeta-express": GazetaExpressProvider,
  "gazeta-blic": GazetaBlicProvider,
} as const;

export type ProviderName = keyof typeof AVAILABLE_PROVIDERS;