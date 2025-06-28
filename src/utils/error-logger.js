const fs = require('fs').promises;

class ErrorLogger {
  constructor(options = {}) {
    this.errorLog = options.errorLog || 'image-lite-errors.log';
    this.logger = options.logger || console;
    this.errors = [];
  }

  async log(file, error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      file,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context: {
        ...context,
        retryCount: context.attempt || 0
      }
    };
    
    this.errors.push(errorEntry);
    
    // Append to error log file
    try {
      const logLine = JSON.stringify(errorEntry) + '\n';
      await fs.appendFile(this.errorLog, logLine);
    } catch (logError) {
      this.logger.error('Failed to write to error log:', logError.message);
    }
  }

  getErrors() {
    return this.errors;
  }

  getErrorCount() {
    return this.errors.length;
  }

  async clear() {
    this.errors = [];
    try {
      await fs.unlink(this.errorLog);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to clear error log:', error.message);
      }
    }
  }
}

module.exports = ErrorLogger;