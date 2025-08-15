/**
 * Shared Provider constants and enums for all Supabase functions
 * This ensures consistency across all functions and prevents typos
 */

export enum Provider {
  TELEGRAFI = "Telegrafi",
  INSAJDERI = "Insajderi", 
  GAZETA_EXPRESS = "Gazeta Express",
  GAZETA_BLIC = "Gazeta Blic",
  INDEKSONLINE = "IndeksOnline"
}

export const PROVIDER_URLS = {
  [Provider.TELEGRAFI]: "https://telegrafi.com",
  [Provider.INSAJDERI]: "https://insajderi.org/category/lajme/",
  [Provider.GAZETA_EXPRESS]: "https://www.gazetaexpress.com/",
  [Provider.GAZETA_BLIC]: "https://gazetablic.com/",
  [Provider.INDEKSONLINE]: "https://indeksonline.net/"
} as const;

export const PROVIDER_USER_AGENTS = {
  [Provider.TELEGRAFI]: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  [Provider.INSAJDERI]: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  [Provider.GAZETA_EXPRESS]: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  [Provider.GAZETA_BLIC]: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  [Provider.INDEKSONLINE]: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
} as const;

/**
 * Get all available provider names
 */
export function getAllProviders(): string[] {
  return Object.values(Provider);
}

/**
 * Check if a provider name is valid
 */
export function isValidProvider(provider: string): provider is Provider {
  return Object.values(Provider).includes(provider as Provider);
}

/**
 * Get provider URL by provider name
 */
export function getProviderUrl(provider: Provider): string {
  return PROVIDER_URLS[provider];
}

/**
 * Get provider user agent by provider name
 */
export function getProviderUserAgent(provider: Provider): string {
  return PROVIDER_USER_AGENTS[provider];
}

/**
 * Get provider name by database value (case-insensitive)
 */
export function getProviderByName(name: string): Provider | null {
  const normalizedName = name.toLowerCase();
  const provider = Object.values(Provider).find(p => p.toLowerCase() === normalizedName);
  return provider || null;
}