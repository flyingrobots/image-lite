const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const sharp = require('sharp');

describe('Configuration End-to-End', () => {
  let testDir;
  const scriptPath = path.join(__dirname, '../scripts/optimize-images.js');
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `image-dump-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'original'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'optimized'), { recursive: true });
    
    // Create a test image
    await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    })
      .png()
      .toFile(path.join(testDir, 'original', 'test-image.png'));
  });
  
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  const runOptimizer = (args = '', env = {}) => {
    const originalDir = process.cwd();
    try {
      process.chdir(testDir);
      const result = execSync(`node ${scriptPath} ${args}`, {
        env: { ...process.env, ...env },
        encoding: 'utf8'
      });
      return { output: result, exitCode: 0 };
    } catch (error) {
      return { output: error.stdout || error.stderr, exitCode: error.status };
    } finally {
      process.chdir(originalDir);
    }
  };
  
  describe('Full optimization with configuration', () => {
    it('should use .imagerc configuration for optimization', async () => {
      // Create configuration
      const config = {
        formats: ['webp', 'original'],
        quality: { webp: 90 },
        generateThumbnails: false
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config, null, 2)
      );
      
      // Run optimization
      const { output, exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      expect(output).toContain('✅ Optimization complete!');
      expect(output).toContain('Processed: 1 images');
      
      // Verify outputs
      const outputFiles = await fs.readdir(path.join(testDir, 'optimized'));
      expect(outputFiles).toContain('test-image.webp');
      expect(outputFiles).toContain('test-image.png');
      expect(outputFiles).not.toContain('test-image.avif');
      expect(outputFiles).not.toContain('test-image-thumb.webp');
    });
    
    it('should work without configuration file', async () => {
      // No .imagerc file
      const { output, exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      expect(output).toContain('✅ Optimization complete!');
      expect(output).toContain('Processed: 1 images');
      
      // Should use defaults: all formats + thumbnail
      const outputFiles = await fs.readdir(path.join(testDir, 'optimized'));
      expect(outputFiles).toContain('test-image.webp');
      expect(outputFiles).toContain('test-image.avif');
      expect(outputFiles).toContain('test-image.png');
      expect(outputFiles).toContain('test-image-thumb.webp');
    });
  });
  
  describe('Format selection', () => {
    it('should only generate specified formats', async () => {
      const config = {
        formats: ['avif'] // Only AVIF
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      const { exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      
      const outputFiles = await fs.readdir(path.join(testDir, 'optimized'));
      expect(outputFiles).toContain('test-image.avif');
      expect(outputFiles).not.toContain('test-image.webp');
      expect(outputFiles).not.toContain('test-image.png');
    });
    
    it('should preserve original when specified', async () => {
      const config = {
        formats: ['original']
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      const { exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      
      const outputFiles = await fs.readdir(path.join(testDir, 'optimized'));
      expect(outputFiles).toContain('test-image.png');
      expect(outputFiles).toHaveLength(1); // Only original
    });
  });
  
  describe('Quality settings', () => {
    it('should apply configured quality levels', async () => {
      const config = {
        formats: ['webp'],
        quality: { webp: 50 } // Low quality
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      const { exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      
      // Low quality WebP should be much smaller
      const originalSize = (await fs.stat(path.join(testDir, 'original', 'test-image.png'))).size;
      const webpSize = (await fs.stat(path.join(testDir, 'optimized', 'test-image.webp'))).size;
      
      expect(webpSize).toBeLessThan(originalSize * 0.3);
    });
    
    it('should use different quality for different formats', async () => {
      const config = {
        formats: ['webp', 'avif'],
        quality: {
          webp: 95, // Very high quality
          avif: 30  // Very low quality
        }
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      // Create a larger, more complex test image for better compression differences
      await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
        .png()
        .toFile(path.join(testDir, 'original', 'test-image.png'));
      
      const { exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      
      const webpSize = (await fs.stat(path.join(testDir, 'optimized', 'test-image.webp'))).size;
      const avifSize = (await fs.stat(path.join(testDir, 'optimized', 'test-image.avif'))).size;
      
      // With such different quality settings, sizes should be noticeably different
      // We're not testing which is smaller because AVIF and WebP have different characteristics
      expect(Math.abs(webpSize - avifSize)).toBeGreaterThan(100);
    });
  });
  
  describe('Custom output directory', () => {
    it('should use configured output directory', async () => {
      const customDir = 'custom-optimized';
      await fs.mkdir(path.join(testDir, customDir), { recursive: true });
      
      const config = {
        outputDir: customDir,
        formats: ['webp']
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      const { exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      
      // Check custom directory
      const customFiles = await fs.readdir(path.join(testDir, customDir));
      expect(customFiles).toContain('test-image.webp');
      
      // Default directory should be empty
      const defaultFiles = await fs.readdir(path.join(testDir, 'optimized'));
      expect(defaultFiles).toHaveLength(0);
    });
  });
  
  describe('Override scenarios', () => {
    it('should allow CLI to override config file', async () => {
      const config = {
        formats: ['webp'],
        generateThumbnails: true
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      // CLI args to disable thumbnails
      const { exitCode } = runOptimizer('--no-thumbnails');
      
      expect(exitCode).toBe(0);
      
      const outputFiles = await fs.readdir(path.join(testDir, 'optimized'));
      expect(outputFiles).toContain('test-image.webp');
      expect(outputFiles).not.toContain('test-image-thumb.webp');
    });
    
    it('should handle invalid config gracefully', async () => {
      // Write invalid JSON
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        '{ invalid json'
      );
      
      const { output, exitCode } = runOptimizer();
      
      // Should fail with clear error
      expect(exitCode).toBe(1);
      expect(output).toContain('Invalid JSON in .imagerc');
    });
    
    it('should validate configuration values', async () => {
      const config = {
        quality: { webp: 150 } // Invalid quality
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      const { output, exitCode } = runOptimizer();
      
      expect(exitCode).toBe(1);
      expect(output).toContain('Quality for webp must be between 1 and 100');
    });
  });
  
  describe('Thumbnail configuration', () => {
    it('should respect thumbnail settings', async () => {
      const config = {
        generateThumbnails: true,
        thumbnailWidth: 100
      };
      
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify(config)
      );
      
      const { exitCode } = runOptimizer();
      
      expect(exitCode).toBe(0);
      
      // Check thumbnail was created with correct size
      const thumbPath = path.join(testDir, 'optimized', 'test-image-thumb.webp');
      const metadata = await sharp(thumbPath).metadata();
      
      expect(metadata.width).toBe(100);
    });
  });
});