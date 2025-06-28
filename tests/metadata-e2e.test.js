const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const sharp = require('sharp');

describe('Metadata Preservation E2E', () => {
  let testDir;
  const scriptPath = path.join(__dirname, '../scripts/optimize-images.js');
  
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `metadata-e2e-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'original'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'optimized'), { recursive: true });
  });
  
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  const runOptimizer = (args = '') => {
    const originalDir = process.cwd();
    try {
      process.chdir(testDir);
      const result = execSync(`node ${scriptPath} ${args}`, {
        encoding: 'utf8'
      });
      return { output: result, exitCode: 0 };
    } catch (error) {
      return { output: error.stdout || error.stderr, exitCode: error.status };
    } finally {
      process.chdir(originalDir);
    }
  };
  
  describe('Default behavior', () => {
    it('should strip metadata by default', async () => {
      // Create image with metadata
      await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .jpeg()
        .withMetadata({
          exif: {
            IFD0: {
              Copyright: 'Test Copyright 2024',
              Artist: 'Test Photographer'
            }
          }
        })
        .toFile(path.join(testDir, 'original', 'test.jpg'));
      
      // Run optimizer with default config
      const { exitCode } = runOptimizer();
      expect(exitCode).toBe(0);
      
      // Check output has no metadata
      const metadata = await sharp(path.join(testDir, 'optimized', 'test.jpg')).metadata();
      expect(metadata.exif).toBeUndefined();
    });
  });
  
  describe('Metadata preservation', () => {
    it('should preserve metadata when configured', async () => {
      // Create config
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify({
          formats: ['original'],
          preserveMetadata: true
        })
      );
      
      // Create image with metadata
      await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .jpeg()
        .withMetadata({
          exif: {
            IFD0: {
              Copyright: 'Preserved Copyright',
              Artist: 'Preserved Artist'
            }
          }
        })
        .toFile(path.join(testDir, 'original', 'test.jpg'));
      
      // Run optimizer
      const { exitCode } = runOptimizer();
      expect(exitCode).toBe(0);
      
      // Check metadata was preserved
      const metadata = await sharp(path.join(testDir, 'optimized', 'test.jpg')).metadata();
      expect(metadata.exif).toBeDefined();
    });
  });
  
  describe('Format compatibility', () => {
    it('should handle metadata in WebP conversion', async () => {
      // Create config
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify({
          formats: ['webp'],
          preserveMetadata: true
        })
      );
      
      // Create JPEG with metadata
      await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      })
        .jpeg()
        .withMetadata({
          exif: {
            IFD0: {
              Copyright: 'WebP Test'
            }
          }
        })
        .toFile(path.join(testDir, 'original', 'test.jpg'));
      
      // Run optimizer
      const { exitCode } = runOptimizer();
      expect(exitCode).toBe(0);
      
      // Check WebP has metadata
      const metadata = await sharp(path.join(testDir, 'optimized', 'test.webp')).metadata();
      expect(metadata.format).toBe('webp');
      // WebP should have metadata if preserved
      expect(metadata.exif).toBeDefined();
    });
  });
  
  describe('Configuration validation', () => {
    it('should reject invalid metadata configuration', async () => {
      await fs.writeFile(
        path.join(testDir, '.imagerc'),
        JSON.stringify({
          preserveMetadata: {
            invalidField: true
          }
        })
      );
      
      const { exitCode, output } = runOptimizer();
      expect(exitCode).toBe(1);
      expect(output).toContain('Invalid metadata field: invalidField');
    });
  });
});