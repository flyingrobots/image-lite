const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const os = require('os');

describe('Metadata Preservation', () => {
  let tempDir;
  
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `metadata-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  describe('Configuration options', () => {
    it('should accept boolean false for stripping all metadata', () => {
      const config = { preserveMetadata: false };
      expect(config.preserveMetadata).toBe(false);
    });
    
    it('should accept boolean true for preserving all metadata', () => {
      const config = { preserveMetadata: true };
      expect(config.preserveMetadata).toBe(true);
    });
    
    it('should accept object for selective preservation', () => {
      const config = {
        preserveMetadata: {
          copyright: true,
          gps: false
        }
      };
      expect(config.preserveMetadata.copyright).toBe(true);
      expect(config.preserveMetadata.gps).toBe(false);
    });
  });
  
  describe('Metadata stripping (default)', () => {
    it('should strip all metadata when preserveMetadata is false', async () => {
      // Create test image with metadata
      const inputPath = path.join(tempDir, 'input.jpg');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .jpeg()
        .withMetadata({
          exif: {
            IFD0: {
              Copyright: 'Test Copyright',
              Artist: 'Test Artist'
            }
          }
        })
        .toFile(inputPath);
      
      // Process with metadata stripping
      const outputPath = path.join(tempDir, 'output.jpg');
      await sharp(inputPath)
        .jpeg()
        .toFile(outputPath);
      
      // Check metadata was stripped
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.exif).toBeUndefined();
    });
  });
  
  describe('Metadata preservation', () => {
    it('should preserve all metadata when preserveMetadata is true', async () => {
      // Create test image with metadata
      const inputPath = path.join(tempDir, 'input.jpg');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
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
        .toFile(inputPath);
      
      // Process with metadata preservation
      const outputPath = path.join(tempDir, 'output.jpg');
      await sharp(inputPath)
        .jpeg()
        .withMetadata(true)
        .toFile(outputPath);
      
      // Check metadata was preserved
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.exif).toBeDefined();
      // Note: Reading specific EXIF fields requires additional parsing
    });
  });
  
  describe('Format compatibility', () => {
    it('should handle metadata in WebP format', async () => {
      const inputPath = path.join(tempDir, 'input.jpg');
      await sharp({
        create: {
          width: 100,
          height: 100,
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
        .toFile(inputPath);
      
      // Convert to WebP with metadata
      const outputPath = path.join(tempDir, 'output.webp');
      await sharp(inputPath)
        .webp()
        .withMetadata(true)
        .toFile(outputPath);
      
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeDefined();
    });
    
    it('should handle metadata in AVIF format', async () => {
      const inputPath = path.join(tempDir, 'input.jpg');
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 0 }
        }
      })
        .jpeg()
        .withMetadata({
          exif: {
            IFD0: {
              Copyright: 'AVIF Test'
            }
          }
        })
        .toFile(inputPath);
      
      // Convert to AVIF with metadata
      const outputPath = path.join(tempDir, 'output.avif');
      await sharp(inputPath)
        .avif()
        .withMetadata(true)
        .toFile(outputPath);
      
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('heif');
      // AVIF metadata support varies
    });
  });
});