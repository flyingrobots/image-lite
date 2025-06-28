const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ErrorRecoveryManager = require('../../src/error-recovery-manager');

describe('ErrorRecoveryManager', () => {
  let errorManager;
  let tempDir;
  
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `error-recovery-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    errorManager = new ErrorRecoveryManager({
      errorLog: path.join(tempDir, 'errors.log'),
      stateFile: path.join(tempDir, 'state.json'),
      continueOnError: true,
      maxRetries: 3,
      retryDelay: 10 // Short delay for tests
    });
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  describe('processWithRecovery', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context = { file: 'test.png' };
      
      const result = await errorManager.processWithRecovery(operation, context);
      
      expect(result).toEqual({
        success: true,
        result: 'success',
        attempts: 1
      });
      // Behavior test: operation succeeded without retries
      expect(result.attempts).toBe(1);
    });
    
    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Busy'), { code: 'EBUSY' }))
        .mockRejectedValueOnce(Object.assign(new Error('Busy'), { code: 'EBUSY' }))
        .mockResolvedValue('success');
      
      const context = { file: 'test.png' };
      
      const result = await errorManager.processWithRecovery(operation, context);
      
      expect(result).toEqual({
        success: true,
        result: 'success',
        attempts: 3
      });
      // Behavior test: operation succeeded after retries
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });
    
    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('Invalid format'));
      
      const context = { file: 'test.png' };
      
      const result = await errorManager.processWithRecovery(operation, context);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      // Behavior test: non-retryable errors fail immediately
      expect(result.error.message).toBe('Invalid format');
    });
    
    it('should respect maxRetries limit', async () => {
      const operation = jest.fn()
        .mockRejectedValue(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }));
      
      const context = { file: 'test.png' };
      
      const result = await errorManager.processWithRecovery(operation, context);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      // Behavior test: stops after max retries
      expect(result.error.message).toBe('Timeout');
    });
    
    it('should throw error when continueOnError is false', async () => {
      errorManager.continueOnError = false;
      const operation = jest.fn()
        .mockRejectedValue(new Error('Fatal error'));
      
      const context = { file: 'test.png' };
      
      await expect(errorManager.processWithRecovery(operation, context))
        .rejects.toThrow('Fatal error');
    });
  });
  
  describe('error logging', () => {
    it('should log errors to file', async () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      
      await errorManager.logError('test.png', error, { attempt: 1 });
      
      const logContent = await fs.readFile(errorManager.errorLog, 'utf8');
      const logEntry = JSON.parse(logContent.trim());
      
      expect(logEntry.file).toBe('test.png');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.code).toBe('TEST_ERROR');
      expect(logEntry.context.attempt).toBe(1);
    });
    
    it('should accumulate errors in memory', async () => {
      await errorManager.logError('test1.png', new Error('Error 1'), {});
      await errorManager.logError('test2.png', new Error('Error 2'), {});
      
      expect(errorManager.errors).toHaveLength(2);
      expect(errorManager.errors[0].file).toBe('test1.png');
      expect(errorManager.errors[1].file).toBe('test2.png');
    });
  });
  
  describe('state management', () => {
    it('should save and load state', async () => {
      errorManager.recordProcessedFile('test1.png', {
        status: 'success',
        outputs: ['test1.webp']
      });
      errorManager.recordProcessedFile('test2.png', {
        status: 'failed',
        error: 'Processing failed'
      });
      
      const state = {
        startedAt: '2024-01-01T00:00:00Z',
        total: 10,
        pending: ['test3.png', 'test4.png'],
        configuration: { quality: 80 }
      };
      
      await errorManager.saveState(state);
      
      // Create new instance and load state
      const newManager = new ErrorRecoveryManager({
        stateFile: errorManager.stateFile
      });
      const loadedState = await newManager.loadState();
      
      expect(loadedState).toBeTruthy();
      expect(loadedState.progress.processed).toBe(2);
      expect(loadedState.progress.succeeded).toBe(1);
      expect(loadedState.progress.failed).toBe(1);
      expect(loadedState.files.pending).toEqual(['test3.png', 'test4.png']);
      
      expect(newManager.isFileProcessed('test1.png')).toBe(true);
      expect(newManager.isFileProcessed('test2.png')).toBe(true);
      expect(newManager.isFileProcessed('test3.png')).toBe(false);
    });
    
    it('should handle missing state file gracefully', async () => {
      const loadedState = await errorManager.loadState();
      expect(loadedState).toBeNull();
    });
    
    it('should handle corrupted state file', async () => {
      await fs.writeFile(errorManager.stateFile, 'invalid json');
      
      const loadedState = await errorManager.loadState();
      expect(loadedState).toBeNull();
    });
    
    it('should clear state file', async () => {
      await errorManager.saveState({ total: 5 });
      
      let exists = await fs.access(errorManager.stateFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      await errorManager.clearState();
      
      exists = await fs.access(errorManager.stateFile).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });
  });
  
  describe('report generation', () => {
    it('should generate summary report', () => {
      errorManager.recordProcessedFile('test1.png', { status: 'success' });
      errorManager.recordProcessedFile('test2.png', { status: 'success' });
      errorManager.recordProcessedFile('test3.png', { status: 'failed' });
      
      const report = errorManager.generateReport();
      
      expect(report.summary.total).toBe(3);
      expect(report.summary.succeeded).toBe(2);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.successRate).toBe('66.7%');
      expect(report.errorLogPath).toBe(errorManager.errorLog);
    });
  });
  
  describe('exponential backoff', () => {
    it('should apply exponential backoff to retries', async () => {
      const startTime = Date.now();
      const operation = jest.fn()
        .mockRejectedValue(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }));
      
      errorManager.maxRetries = 3;
      errorManager.retryDelay = 50;
      
      await errorManager.processWithRecovery(operation, { file: 'test.png' });
      
      const elapsed = Date.now() - startTime;
      // Expected delays: 50ms (1st retry) + 100ms (2nd retry) = 150ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(150);
      // Behavior test: retries happened with exponential delays
    });
    
    it('should use linear delay when exponentialBackoff is false', async () => {
      errorManager.exponentialBackoff = false;
      const startTime = Date.now();
      const operation = jest.fn()
        .mockRejectedValue(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }));
      
      errorManager.maxRetries = 3;
      errorManager.retryDelay = 50;
      
      await errorManager.processWithRecovery(operation, { file: 'test.png' });
      
      const elapsed = Date.now() - startTime;
      // Expected delays: 50ms + 50ms = 100ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200); // Should not use exponential backoff
    });
  });
});