/**
 * Shared logger utility using Pino for better performance and structured logging
 * Provides a simple interface with emojis for visual feedback
 */

import pino from "pino";

// Create logger instance with configuration optimized for edge functions
const pinoLogger = pino({
  level: "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "crawl-gazeta-blic"
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

  scraping: (message: string, data?: any) => {
    const formattedMessage = `📰 ${message}`;
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
  }
};

/**
 * Available log methods:
 * - logger.info() - General information with ℹ️
 * - logger.success() - Success messages with ✅
 * - logger.warn() - Warning messages with ⚠️
 * - logger.error() - Error messages with ❌
 * - logger.scraping() - Scraping operations with 📰
 * - logger.starting() - Starting/initialization with 🚀
 * - logger.stats() - Statistics and summaries with 📊
 */