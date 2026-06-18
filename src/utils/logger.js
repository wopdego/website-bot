const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const logger = {
  debug: (...args) => { if (currentLevel <= LOG_LEVELS.DEBUG) console.log(`[${timestamp()}] [DEBUG]`, ...args); },
  info: (...args) => { if (currentLevel <= LOG_LEVELS.INFO) console.log(`[${timestamp()}] [INFO]`, ...args); },
  warn: (...args) => { if (currentLevel <= LOG_LEVELS.WARN) console.warn(`[${timestamp()}] [WARN]`, ...args); },
  error: (...args) => { if (currentLevel <= LOG_LEVELS.ERROR) console.error(`[${timestamp()}] [ERROR]`, ...args); },
};
