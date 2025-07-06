/**
 * Centralized logger utility that handles different log levels
 * and suppresses logs in production environment
 */

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Current log level - set to INFO in production, DEBUG in development
const currentLogLevel = isProduction ? LogLevel.INFO : LogLevel.DEBUG;

/**
 * Main logger class
 */
class Logger {
  /**
   * Log a debug message
   * Debug messages are only shown in development mode
   */
  debug(...args: any[]): void {
    if (!isProduction && currentLogLevel <= LogLevel.DEBUG) {
      console.debug('[DEBUG]', ...args);
    }
  }

  /**
   * Log an info message
   * Production info logs are minimal
   */
  info(...args: any[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      // In production, only log critical info
      if (!isProduction || args[0]?.critical) {
        console.info('[INFO]', ...args);
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(...args: any[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  /**
   * Log an error message
   * Errors are always logged in all environments
   */
  error(...args: any[]): void {
    console.error('[ERROR]', ...args);
  }
}

// Export a singleton instance
export const logger = new Logger();

// For compatibility with existing code using console directly
export const loggerConsole = {
  log: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
  info: (...args: any[]) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  }
};

export default logger;