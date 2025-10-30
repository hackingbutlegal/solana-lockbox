/**
 * Logger utility for conditional console output
 *
 * Only logs in development mode to keep production console clean
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors, but only full details in development
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, log minimal error info
      console.error('An error occurred. Enable development mode for details.');
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};
