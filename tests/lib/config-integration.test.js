const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ConfigLoader = require('../../src/config/config-loader');

describe('Configuration Integration', () => {
  let tempDir;
  let configLoader;
  
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `image-dump-config-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    configLoader = new ConfigLoader();
    
    // Change to temp directory for tests
    process.chdir(tempDir);
  });
  
  afterEach(async () => {
    // Restore original directory
    process.chdir(__dirname);
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  describe('File system interaction', () => {
    it('should find .imagerc in current working directory', async () => {
      const testConfig = {
        formats: ['webp'],
        quality: { webp: 95 }
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(testConfig));
      
      const config = await configLoader.loadConfig();
      
      expect(config.formats).toEqual(['webp']);
      expect(config.quality.webp).toBe(95);
    });
    
    it('should handle permission errors when reading config', async () => {
      // Skip this test in Docker environments where root can read any file
      if (process.getuid && process.getuid() === 0) {
        return;
      }
      
      await fs.writeFile('.imagerc', JSON.stringify({ formats: ['webp'] }));
      await fs.chmod('.imagerc', 0o000); // Remove all permissions
      
      // Should not throw, but return defaults
      const config = await configLoader.loadConfig();
      
      expect(config.formats).toEqual(['webp', 'avif', 'original']);
      
      // Restore permissions for cleanup
      await fs.chmod('.imagerc', 0o644);
    });
    
    it('should find .imagerc.json when .imagerc does not exist', async () => {
      const testConfig = {
        generateThumbnails: false,
        thumbnailWidth: 300
      };
      
      await fs.writeFile('.imagerc.json', JSON.stringify(testConfig));
      
      const config = await configLoader.loadConfig();
      
      expect(config.generateThumbnails).toBe(false);
      expect(config.thumbnailWidth).toBe(300);
    });
  });
  
  describe('CLI argument integration', () => {
    it('should allow CLI args to override file config', async () => {
      // Write config file
      await fs.writeFile('.imagerc', JSON.stringify({
        formats: ['webp'],
        quality: { webp: 80 }
      }));
      
      // Simulate CLI args
      const cliArgs = {
        formats: ['avif', 'original'],
        quality: { webp: 90 }
      };
      
      const config = await configLoader.loadConfig(tempDir, cliArgs);
      
      expect(config.formats).toEqual(['avif', 'original']); // CLI override
      expect(config.quality.webp).toBe(90); // CLI override
    });
    
    it('should merge CLI args with file config properly', async () => {
      await fs.writeFile('.imagerc', JSON.stringify({
        formats: ['webp'],
        generateThumbnails: false,
        quality: {
          webp: 85,
          avif: 80
        }
      }));
      
      const cliArgs = {
        quality: {
          webp: 95 // Only override WebP quality
        }
      };
      
      const config = await configLoader.loadConfig(tempDir, cliArgs);
      
      expect(config.formats).toEqual(['webp']); // From file
      expect(config.generateThumbnails).toBe(false); // From file
      expect(config.quality.webp).toBe(95); // CLI override
      expect(config.quality.avif).toBe(80); // From file
    });
  });
  
  describe('Configuration validation in context', () => {
    it('should validate configuration when loaded from file', async () => {
      const invalidConfig = {
        formats: ['invalid-format']
      };
      
      await fs.writeFile('.imagerc', JSON.stringify(invalidConfig));
      
      await expect(configLoader.loadConfig()).rejects.toThrow('Invalid format: invalid-format');
    });
    
    it('should validate merged configuration', async () => {
      await fs.writeFile('.imagerc', JSON.stringify({
        quality: { webp: 80 }
      }));
      
      const cliArgs = {
        quality: { avif: 150 } // Invalid
      };
      
      await expect(configLoader.loadConfig(tempDir, cliArgs))
        .rejects.toThrow('Quality for avif must be between 1 and 100');
    });
  });
});