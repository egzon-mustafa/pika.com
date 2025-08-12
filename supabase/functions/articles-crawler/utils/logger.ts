/**
 * Shared logger utility using Pino for better performance and structured logging
 * Provides a simple interface with emojis for visual feedback
 */

import pino from "pino";

// Create logger instance with configuration optimized for edge functions
const pinoLogger = pino({
  level: "info", // Set default log level
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Simple JSON output for edge functions
  base: {
    service: "articles-crawler"
  },
});

/**
 * Simple logger interface with emojis
 */
export const logger = {
  info: (message: string, data?: any) => {
    const formattedMessage = `ℹ️ ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  },

  success: (message: string, data?: any) => {
    const formattedMessage = `✅ ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  },

  warn: (message: string, data?: any) => {
    const formattedMessage = `⚠️ ${message}`;
    if (data) {
      pinoLogger.warn(data, formattedMessage);
    } else {
      pinoLogger.warn(formattedMessage);
    }
  },

  error: (message: string, data?: any) => {
    const formattedMessage = `❌ ${message}`;
    if (data) {
      pinoLogger.error(data, formattedMessage);
    } else {
      pinoLogger.error(formattedMessage);
    }
  },

  debug: (message: string, data?: any) => {
    const formattedMessage = `🔍 ${message}`;
    if (data) {
      pinoLogger.debug(data, formattedMessage);
    } else {
      pinoLogger.debug(formattedMessage);
    }
  },

  scraping: (message: string, data?: any) => {
    const formattedMessage = `📰 ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  },

  processing: (message: string, data?: any) => {
    const formattedMessage = `⚙️ ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  },

  starting: (message: string, data?: any) => {
    const formattedMessage = `🚀 ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  },

  stats: (message: string, data?: any) => {
    const formattedMessage = `📊 ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  },

  page: (message: string, data?: any) => {
    const formattedMessage = `📄 ${message}`;
    if (data) {
      pinoLogger.info(data, formattedMessage);
    } else {
      pinoLogger.info(formattedMessage);
    }
  }
};

/**
 * Create a child logger with a specific context/component name
 * (keeping for backward compatibility)
 */
export function createLogger(component: string) {
  const childLogger = pinoLogger.child({ component });
  
  return {
    info: (message: string, data?: any) => logger.info(`[${component}] ${message}`, data),
    success: (message: string, data?: any) => logger.success(`[${component}] ${message}`, data),
    warn: (message: string, data?: any) => logger.warn(`[${component}] ${message}`, data),
    error: (message: string, data?: any) => logger.error(`[${component}] ${message}`, data),
    debug: (message: string, data?: any) => logger.debug(`[${component}] ${message}`, data),
    scraping: (message: string, data?: any) => logger.scraping(`[${component}] ${message}`, data),
    processing: (message: string, data?: any) => logger.processing(`[${component}] ${message}`, data),
    starting: (message: string, data?: any) => logger.starting(`[${component}] ${message}`, data),
    stats: (message: string, data?: any) => logger.stats(`[${component}] ${message}`, data),
    page: (message: string, data?: any) => logger.page(`[${component}] ${message}`, data),
  };
}

/**
 * Available log methods:
 * - logger.info() - General information with ℹ️
 * - logger.success() - Success messages with ✅
 * - logger.warn() - Warning messages with ⚠️
 * - logger.error() - Error messages with ❌
 * - logger.debug() - Debug information with 🔍
 * - logger.scraping() - Scraping operations with 📰
 * - logger.processing() - Processing operations with ⚙️
 * - logger.starting() - Starting/initialization with 🚀
 * - logger.stats() - Statistics and summaries with 📊
 * - logger.page() - Page operations with 📄
 */