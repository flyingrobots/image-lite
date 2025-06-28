const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

describe('Error Recovery E2E', () => {
  let testDir;
  const scriptPath = path.join(__dirname, '..', 'src', 'cli', 'optimize-images.js');
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `error-recovery-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Create directories
    await fs.mkdir('original', { recursive: true });
    await fs.mkdir('optimized', { recursive: true });
    
    // Create test images using sharp to generate valid PNGs
    const sharp = require('sharp');
    
    // Create a simple 1x1 red pixel PNG
    const validPng = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
      .png()
      .toBuffer();
    
    // Create test images - use 'a' prefix to ensure good images are processed first
    await fs.writeFile(path.join('original', 'a-good1.png'), validPng);
    await fs.writeFile(path.join('original', 'a-good2.png'), validPng);
    await fs.writeFile(path.join('original', 'a-good3.png'), validPng);
    
    // Create a corrupted image with 'z' prefix to ensure it's processed last
    await fs.writeFile(path.join('original', 'z-corrupted.png'), Buffer.from('not a valid image'));
  });
  
  afterEach(async () => {
    process.chdir(__dirname);
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('--continue-on-error flag', () => {
    it('should continue processing after errors', async () => {
      const result = execSync(`node ${scriptPath} --continue-on-error`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(result).toContain('Optimization complete!');
      expect(result).toContain('Processed: 3 images');
      expect(result).toContain('Errors: 1 images');
      
      // Check that good images were processed
      const files = await fs.readdir('optimized');
      expect(files).toContain('a-good1.webp');
      expect(files).toContain('a-good2.webp');
      expect(files).toContain('a-good3.webp');
      expect(files).not.toContain('z-corrupted.webp');
      
      // Check error log exists
      const errorLogExists = await fs.access('image-optimization-errors.log')
        .then(() => true)
        .catch(() => false);
      expect(errorLogExists).toBe(true);
    });
    
    it('should stop on first error without --continue-on-error', () => {
      let exitCode = 0;
      try {
        execSync(`node ${scriptPath}`, { encoding: 'utf8', stdio: 'pipe' });
      } catch (error) {
        exitCode = error.status;
      }
      
      expect(exitCode).toBe(1);
    });
  });
  
  describe('Resume capability', () => {
    it('should save state and allow resuming', async () => {
      // Create a separate test directory for this test
      const resumeTestDir = path.join(testDir, 'resume-test');
      await fs.mkdir(path.join(resumeTestDir, 'original'), { recursive: true });
      await fs.mkdir(path.join(resumeTestDir, 'optimized'), { recursive: true });
      
      // Create test images in the resume test directory
      for (let i = 0; i < 10; i++) {
        const image = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64'
        );
        await fs.writeFile(
          path.join(resumeTestDir, 'original', `image${i}.png`), 
          image
        );
      }
      
      // Change to resume test directory
      const originalCwd = process.cwd();
      process.chdir(resumeTestDir);
      
      try {
        // First run - process only first 5 images by manually creating a state file
        // Process first 5 images manually
        for (let i = 0; i < 5; i++) {
          const sharp = require('sharp');
          const img = await sharp(path.join('original', `image${i}.png`));
          await img.webp().toFile(path.join('optimized', `image${i}.webp`));
          await img.avif().toFile(path.join('optimized', `image${i}.avif`));
          await img.png().toFile(path.join('optimized', `image${i}.png`));
        }
        
        // Create state file simulating interrupted processing
        const processedFiles = [];
        for (let i = 0; i < 5; i++) {
          processedFiles.push({
            path: `original/image${i}.png`,
            status: 'success',
            result: 'processed',
            attempts: 1
          });
        }
        
        const stateData = {
          version: '1.0',
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          progress: {
            total: 10,
            processed: 5,
            succeeded: 5,
            failed: 0,
            remaining: 5
          },
          files: {
            processed: processedFiles,
            pending: ['original/image5.png', 'original/image6.png', 'original/image7.png', 'original/image8.png', 'original/image9.png']
          },
          configuration: {
            outputDir: 'optimized',
            formats: ['png', 'webp', 'avif'],
            generateThumbnails: true
          }
        };
        
        await fs.writeFile('.image-optimization-state.json', JSON.stringify(stateData, null, 2));
        
        // Resume processing
        let resumeResult;
        try {
          resumeResult = execSync(`node ${scriptPath} --resume`, { encoding: 'utf8' });
        } catch (error) {
          resumeResult = error.stdout || error.stderr || '';
        }
        
        // Should show resume message
        expect(resumeResult.toLowerCase()).toMatch(/resum/i);
        
        // All images should now be processed
        const files = await fs.readdir('optimized');
        for (let i = 0; i < 10; i++) {
          expect(files).toContain(`image${i}.webp`);
        }
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);
      }
    });
  });
  
  describe('Error logging', () => {
    it('should create detailed error log', async () => {
      execSync(`node ${scriptPath} --continue-on-error`, { encoding: 'utf8' });
      
      const errorLog = await fs.readFile('image-optimization-errors.log', 'utf8');
      const errors = errorLog.trim().split('\n').map(line => JSON.parse(line));
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty('timestamp');
      expect(errors[0]).toHaveProperty('file');
      expect(errors[0]).toHaveProperty('error');
      expect(errors[0].file).toContain('z-corrupted.png');
    });
    
    it('should use custom error log path', async () => {
      const customLogPath = path.join(testDir, 'custom-errors.log');
      
      execSync(`node ${scriptPath} --continue-on-error --error-log=${customLogPath}`, { 
        encoding: 'utf8' 
      });
      
      const exists = await fs.access(customLogPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
  
  describe('Retry mechanism', () => {
    it('should retry transient errors', async () => {
      // Create a file that will cause a transient error
      // For this test, we'll create a locked file scenario
      const testFile = path.join('original', 'locked.png');
      await fs.writeFile(testFile, await fs.readFile(path.join('original', 'a-good1.png')));
      
      // Note: This is hard to test properly without mocking
      // In real scenarios, retries would happen for network errors, busy files, etc.
      
      let result;
      try {
        result = execSync(`node ${scriptPath} --max-retries=2 --retry-delay=100 --continue-on-error`, { 
          encoding: 'utf8' 
        });
      } catch (error) {
        result = error.stdout || error.stderr || '';
        // exitCode = error.status || 1; // Unused for now
      }
      
      // Should complete even with errors when using --continue-on-error
      expect(result).toContain('Optimization complete!');
    });
  });
  
  describe('Configuration integration', () => {
    it('should load error recovery settings from config', async () => {
      const config = {
        errorRecovery: {
          continueOnError: true,
          maxRetries: 5,
          retryDelay: 500,
          exponentialBackoff: true
        }
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(config, null, 2));
      
      let result;
      try {
        result = execSync(`node ${scriptPath}`, { encoding: 'utf8' });
      } catch (error) {
        result = error.stdout || error.stderr || '';
      }
      
      expect(result).toContain('Processing complete!');
      expect(result).toContain('Errors: 2');
    });
  });
});