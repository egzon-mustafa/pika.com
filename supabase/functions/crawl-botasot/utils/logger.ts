/**
 * Logger utility for the BotaSot crawler
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "success" | "starting" | "scraping" | "processing" | "stats";

interface LogContext {
  [key: string]: any;
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  success: (message: string, context?: LogContext) => log("success", message, context),
  starting: (message: string, context?: LogContext) => log("starting", message, context),
  scraping: (message: string, context?: LogContext) => log("scraping", message, context),
  processing: (message: string, context?: LogContext) => log("processing", message, context),
  stats: (message: string, context?: LogContext) => log("stats", message, context),
};

function log(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(context && { context }),
  };

  // Color mapping for different log levels
  const colors = {
    debug: "\x1b[90m",    // Gray
    info: "\x1b[36m",     // Cyan
    warn: "\x1b[33m",     // Yellow
    error: "\x1b[31m",    // Red
    success: "\x1b[32m",  // Green
    starting: "\x1b[35m", // Magenta
    scraping: "\x1b[34m", // Blue
    processing: "\x1b[36m", // Cyan
    stats: "\x1b[37m",    // White
  };

  const reset = "\x1b[0m";
  const color = colors[level] || colors.info;

  // Console output with color
  console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, context ? context : '');
}