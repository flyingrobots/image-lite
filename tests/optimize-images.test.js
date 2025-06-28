const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const sharp = require('sharp');

describe('optimize-images.js', () => {
  const testDir = path.join(os.tmpdir(), `image-dump-test-${Date.now()}`);
  const inputDir = path.join(testDir, 'original');
  const outputDir = path.join(testDir, 'optimized');
  const scriptPath = path.join(__dirname, '../scripts/optimize-images.js');

  beforeEach(async () => {
    // Clean up test directories
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const runScript = (args = '', env = {}) => {
    const originalDir = process.cwd();
    try {
      process.chdir(testDir);
      const result = execSync(`node ${scriptPath} ${args} 2>&1`, {
        env: { ...process.env, ...env },
        encoding: 'utf8',
        shell: true
      });
      return { output: result, exitCode: 0 };
    } catch (error) {
      return { 
        output: error.stdout || error.stderr || error.message,
        exitCode: error.status || 1
      };
    } finally {
      process.chdir(originalDir);
    }
  };

  test('should process valid PNG image without metadata errors', async () => {
    // Create a test PNG image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(inputDir, 'test.png'));

    const result = runScript();
    
    // Test behavior, not exact output
    expect(result.exitCode).toBe(0);
    
    // Check that optimization actually happened by verifying output files exist
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('test.png');
    expect(outputFiles).toContain('test.webp');
    expect(outputFiles).toContain('test.avif');
    expect(outputFiles).toContain('test-thumb.webp');
    
    // Verify the files are valid images
    await sharp(path.join(outputDir, 'test.png')).metadata();
    await sharp(path.join(outputDir, 'test.webp')).metadata();
    await sharp(path.join(outputDir, 'test.avif')).metadata();
    await sharp(path.join(outputDir, 'test-thumb.webp')).metadata();
    
    // Verify completion message exists somewhere in output
    expect(result.output).toMatch(/optimization complete|processed.*1|✅/i);
  });

  test('should exit with error code when processing fails', async () => {
    // Create an invalid/corrupt image file
    await fs.writeFile(path.join(inputDir, 'corrupt.png'), 'not a real png file');

    const result = runScript();
    
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('❌ Error processing corrupt.png');
    expect(result.output).toContain('Fatal error');
  });

  test('should skip already processed images', async () => {
    // Create a test image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(inputDir, 'test.png'));

    // First run - ensure files are created
    const firstRun = runScript();
    expect(firstRun.exitCode).toBe(0);
    
    // Wait a bit to ensure file timestamps are different
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Get modification times of output files after first run
    const outputPath = path.join(outputDir, 'test.png');
    const stats1 = await fs.stat(outputPath);
    
    // Second run should skip (not modify files)
    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    
    // Verify files were not modified (same modification time)
    const stats2 = await fs.stat(outputPath);
    expect(stats2.mtime.getTime()).toBe(stats1.mtime.getTime());
    
    // Verify skip behavior in output
    expect(result.output.toLowerCase()).toMatch(/skip|already|up to date/i);
  });

  test('should force reprocess with --force flag', async () => {
    // Create a test image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(inputDir, 'test.png'));

    // First run
    const firstRun = runScript();
    expect(firstRun.exitCode).toBe(0);
    
    // Wait to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get modification time after first run
    const outputPath = path.join(outputDir, 'test.png');
    const stats1 = await fs.stat(outputPath);
    
    // Second run with force should reprocess (update modification time)
    const result = runScript('--force');
    
    expect(result.exitCode).toBe(0);
    
    // Verify file was reprocessed (newer modification time)
    const stats2 = await fs.stat(outputPath);
    expect(stats2.mtime.getTime()).toBeGreaterThan(stats1.mtime.getTime());
    
    // Should indicate processing happened
    expect(result.output.toLowerCase()).toMatch(/process|complete/i);
    // When forced, should show 0 skipped (not skip any)
    const skippedMatch = result.output.match(/skipped:\s*(\d+)/i);
    const skippedCount = skippedMatch ? parseInt(skippedMatch[1]) : 0;
    expect(skippedCount).toBe(0);
  });

  test('should handle multiple images with mixed results', async () => {
    // Create valid image
    await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(inputDir, 'valid.png'));

    // Create corrupt image
    await fs.writeFile(path.join(inputDir, 'corrupt.jpg'), 'not a real jpg');

    const result = runScript('--continue-on-error');
    
    // With --continue-on-error, it should complete successfully
    expect(result.exitCode).toBe(0);
    
    // Check that valid image was processed
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('valid.png');
    expect(outputFiles).toContain('valid.webp');
    
    // Corrupt image should not have output files
    expect(outputFiles).not.toContain('corrupt.jpg');
    expect(outputFiles).not.toContain('corrupt.webp');
    
    // Should mention errors in output
    expect(result.output.toLowerCase()).toMatch(/error/i);
    
    // Check for error log file creation (might be in working directory)
    const errorLogPath = path.join(testDir, 'image-optimization-errors.log');
    const errorLogExists = await fs.access(errorLogPath).then(() => true).catch(() => false);
    
    // Also check if it was created in current working directory
    const cwdErrorLog = await fs.access('image-optimization-errors.log').then(() => true).catch(() => false);
    
    expect(errorLogExists || cwdErrorLog).toBe(true);
  });

  test('should handle WebP input files', async () => {
    // Create a test WebP image
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 }
      }
    })
      .webp()
      .toFile(path.join(inputDir, 'test.webp'));

    // Create config to only generate WebP format
    await fs.writeFile(
      path.join(testDir, '.imagerc'),
      JSON.stringify({
        formats: ['webp', 'original'],
        generateThumbnails: true
      })
    );

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    
    // Check output files were created
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('test-thumb.webp');
    
    // Should create at least thumbnail since generateThumbnails is true
    expect(outputFiles.length).toBeGreaterThan(0);
    
    // Verify the thumbnail is a valid WebP image
    const metadata = await sharp(path.join(outputDir, 'test-thumb.webp')).metadata();
    expect(metadata.format).toBe('webp');
    
    const thumbMetadata = await sharp(path.join(outputDir, 'test-thumb.webp')).metadata();
    expect(thumbMetadata.format).toBe('webp');
    expect(thumbMetadata.width).toBeLessThanOrEqual(300); // Default thumbnail size
  });

  test('should copy GIF files without optimization', async () => {
    // Create a simple GIF file (just a valid header for testing)
    const gifHeader = Buffer.from('GIF89a', 'ascii');
    await fs.writeFile(path.join(inputDir, 'test.gif'), gifHeader);

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    
    // Check that GIF was copied to output
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('test.gif');
    
    // Verify it's the same file (was copied, not processed)
    const inputContent = await fs.readFile(path.join(inputDir, 'test.gif'));
    const outputContent = await fs.readFile(path.join(outputDir, 'test.gif'));
    expect(outputContent).toEqual(inputContent);
    
    // Should not create alternate formats for GIF
    expect(outputFiles).not.toContain('test.webp');
    expect(outputFiles).not.toContain('test.avif');
  });

  test('should resume from previous state when --resume flag is used', async () => {
    // Create multiple test images
    for (let i = 1; i <= 3; i++) {
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: i * 50, g: i * 50, b: i * 50, alpha: 1 }
        }
      })
        .png()
        .toFile(path.join(inputDir, `test${i}.png`));
    }

    // First, process just the first image
    await fs.writeFile(
      path.join(testDir, '.imagerc'),
      JSON.stringify({
        formats: ['png'],
        generateThumbnails: false
      })
    );
    
    // Process test1.png manually to establish baseline
    await sharp(path.join(inputDir, 'test1.png'))
      .png()
      .toFile(path.join(outputDir, 'test1.png'));

    // Create a state file with processed files tracking
    const processedFiles = new Map();
    processedFiles.set(path.join('original', 'test1.png'), {
      status: 'success',
      result: 'processed',
      attempts: 1
    });
    
    const stateFile = {
      version: '1.0',
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      progress: {
        total: 3,
        processed: 1,
        succeeded: 1,
        failed: 0,
        remaining: 2
      },
      files: {
        processed: [{
          path: path.join('original', 'test1.png'),
          status: 'success',
          result: 'processed',
          attempts: 1
        }],
        pending: [
          path.join('original', 'test2.png'),
          path.join('original', 'test3.png')
        ]
      },
      configuration: {
        outputDir: 'optimized',
        formats: ['png', 'webp', 'avif'],
        generateThumbnails: true
      }
    };
    
    await fs.writeFile(
      path.join(testDir, '.image-optimization-state.json'),
      JSON.stringify(stateFile, null, 2)
    );

    // Update config for full processing
    await fs.writeFile(
      path.join(testDir, '.imagerc'),
      JSON.stringify({
        formats: ['png', 'webp', 'avif'],
        generateThumbnails: true
      })
    );

    // Get initial file count
    const filesBeforeResume = await fs.readdir(outputDir);
    
    // Run with resume flag
    const result = runScript('--resume');
    
    expect(result.exitCode).toBe(0);
    
    // Check that resume was acknowledged
    expect(result.output.toLowerCase()).toMatch(/resum/i);
    
    // Should have processed test2 and test3, but skipped test1
    const outputFiles = await fs.readdir(outputDir);
    
    // All base files should exist
    expect(outputFiles).toContain('test1.png'); // Already existed
    expect(outputFiles).toContain('test2.png'); // Newly processed
    expect(outputFiles).toContain('test3.png'); // Newly processed
    
    // test2 and test3 should have full processing
    expect(outputFiles).toContain('test2.webp');
    expect(outputFiles).toContain('test2.avif');
    expect(outputFiles).toContain('test3.webp');
    expect(outputFiles).toContain('test3.avif');
    
    // Verify by file count - should have added more files than before
    expect(outputFiles.length).toBeGreaterThan(filesBeforeResume.length);
  });

  test('should show progress information during processing', async () => {
    // Create multiple images to ensure progress is shown
    for (let i = 1; i <= 5; i++) {
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: i * 40, g: i * 40, b: i * 40, alpha: 1 }
        }
      })
        .png()
        .toFile(path.join(inputDir, `test${i}.png`));
    }

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    
    // Progress should be shown in output (contains processing-related text)
    expect(result.output.toLowerCase()).toMatch(/process|progress|complete/i);
    
    // All files should be processed
    const outputFiles = await fs.readdir(outputDir);
    for (let i = 1; i <= 5; i++) {
      expect(outputFiles).toContain(`test${i}.png`);
      expect(outputFiles).toContain(`test${i}.webp`);
    }
  });

  test('should continue processing after errors with --continue-on-error flag', async () => {
    // Create mix of valid and invalid images
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(inputDir, 'valid1.png'));
    
    await fs.writeFile(path.join(inputDir, 'corrupt.png'), 'not a valid png');
    
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(inputDir, 'valid2.png'));

    const result = runScript('--continue-on-error');
    
    // Should complete successfully with --continue-on-error
    expect(result.exitCode).toBe(0);
    
    // Valid images should be processed
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('valid1.png');
    expect(outputFiles).toContain('valid1.webp');
    expect(outputFiles).toContain('valid2.png');
    expect(outputFiles).toContain('valid2.webp');
    
    // Corrupt image should not have outputs
    expect(outputFiles).not.toContain('corrupt.png');
    expect(outputFiles).not.toContain('corrupt.webp');
    
    // Error log should be created
    const errorLogExists = await fs.access(path.join(testDir, 'image-optimization-errors.log'))
      .then(() => true)
      .catch(() => false);
    expect(errorLogExists).toBe(true);
    
    // Output should mention errors
    expect(result.output.toLowerCase()).toMatch(/error/i);
  });

  test('should handle subdirectories correctly', async () => {
    // Create subdirectory with image
    const subdir = path.join(inputDir, 'subdir');
    await fs.mkdir(subdir, { recursive: true });
    
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 100, g: 100, b: 100, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(subdir, 'nested.png'));

    const result = runScript();
    
    expect(result.exitCode).toBe(0);
    
    // Check subdirectory was created in output
    const outputSubdir = path.join(outputDir, 'subdir');
    const subdirExists = await fs.access(outputSubdir).then(() => true).catch(() => false);
    expect(subdirExists).toBe(true);
    
    // Check files in subdirectory
    const outputFiles = await fs.readdir(outputSubdir);
    expect(outputFiles).toContain('nested.png');
    expect(outputFiles).toContain('nested.webp');
    expect(outputFiles).toContain('nested.avif');
    expect(outputFiles).toContain('nested-thumb.webp');
  });
});