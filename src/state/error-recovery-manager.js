const StatePersistenceManager = require('./state-persistence-manager');
const ErrorLogger = require('../utils/error-logger');

class ErrorRecoveryManager {
  constructor(options = {}) {
    this.continueOnError = options.continueOnError || false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.exponentialBackoff = options.exponentialBackoff !== false;
    this.processedFiles = new Map();
    this.logger = options.logger || console;
    
    // Delegate state persistence and error logging
    this.statePersistence = new StatePersistenceManager({
      stateFile: options.stateFile,
      logger: this.logger
    });
    
    this.errorLogger = new ErrorLogger({
      errorLog: options.errorLog,
      logger: this.logger
    });
  }

  async processWithRecovery(operation, context) {
    let lastError;
    const retryableErrors = ['ENOENT', 'EBUSY', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        return { success: true, result, attempts: attempt };
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = retryableErrors.includes(error.code) || 
                          (error.message && error.message.includes('LFS'));
        
        if (!isRetryable || attempt === this.maxRetries) {
          // Log the error
          await this.errorLogger.log(context.file, error, { ...context, attempt });
          
          if (this.continueOnError) {
            return { success: false, error, attempts: attempt };
          } else {
            throw error;
          }
        }
        
        // Calculate delay with exponential backoff
        const delay = this.exponentialBackoff 
          ? this.retryDelay * Math.pow(2, attempt - 1)
          : this.retryDelay;
          
        this.logger.log(`Retry attempt ${attempt}/${this.maxRetries} for ${context.file} after ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    return { success: false, error: lastError, attempts: this.maxRetries };
  }

  async saveState(state) {
    const processedArray = Array.from(this.processedFiles.entries()).map(([path, data]) => ({
      path,
      ...data
    }));
    
    const stateToSave = {
      ...state,
      progress: {
        total: state.total || 0,
        processed: this.processedFiles.size,
        succeeded: processedArray.filter(f => f.status === 'success').length,
        failed: processedArray.filter(f => f.status === 'failed').length,
        remaining: state.total - this.processedFiles.size
      },
      files: {
        processed: processedArray,
        pending: state.pending || []
      }
    };
    
    await this.statePersistence.save(stateToSave);
  }

  async loadState() {
    const state = await this.statePersistence.load();
    
    if (state && state.files && state.files.processed) {
      // Restore processed files
      state.files.processed.forEach(file => {
        this.processedFiles.set(file.path, {
          status: file.status,
          error: file.error,
          outputs: file.outputs
        });
      });
    }
    
    return state;
  }

  async clearState() {
    await this.statePersistence.clear();
    await this.errorLogger.clear();
    this.processedFiles.clear();
  }

  recordProcessedFile(filePath, result) {
    this.processedFiles.set(filePath, result);
  }

  isFileProcessed(filePath) {
    return this.processedFiles.has(filePath);
  }

  generateReport() {
    const processedArray = Array.from(this.processedFiles.values());
    const succeeded = processedArray.filter(f => f.status === 'success').length;
    const failed = processedArray.filter(f => f.status === 'failed').length;
    
    return {
      summary: {
        total: this.processedFiles.size,
        succeeded,
        failed,
        successRate: this.processedFiles.size > 0 ? (succeeded / this.processedFiles.size * 100).toFixed(1) + '%' : '0%'
      },
      errors: this.errorLogger.getErrors(),
      errorCount: this.errorLogger.getErrorCount(),
      errorLogPath: this.errorLogger.errorLog
    };
  }

  // Delegate methods for backward compatibility with tests
  logError(file, error, context) {
    return this.errorLogger.log(file, error, context);
  }

  get errors() {
    return this.errorLogger.getErrors();
  }

  get errorLog() {
    return this.errorLogger.errorLog;
  }

  get stateFile() {
    return this.statePersistence.stateFile;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ErrorRecoveryManager;