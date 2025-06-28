const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ConfigLoader = require('../../src/config/config-loader');

describe('ConfigLoader', () => {
  let configLoader;
  let tempDir;
  
  beforeEach(async () => {
    configLoader = new ConfigLoader();
    // Create a temporary directory for test files
    tempDir = path.join(os.tmpdir(), `config-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  describe('loadConfig', () => {
    it('should return default configuration when no .imagerc exists', async () => {
      const config = await configLoader.loadConfig(tempDir);
      
      expect(config).toEqual({
        formats: ['webp', 'avif', 'original'],
        quality: {
          webp: 80,
          avif: 80,
          jpeg: 80
        },
        outputDir: 'optimized',
        generateThumbnails: true,
        thumbnailWidth: 200,
        preserveMetadata: false
      });
    });
    
    it('should load and parse valid .imagerc file', async () => {
      const customConfig = {
        formats: ['webp'],
        quality: {
          webp: 90
        }
      };
      
      await fs.writeFile(
        path.join(tempDir, '.imagerc'),
        JSON.stringify(customConfig, null, 2)
      );
      
      const config = await configLoader.loadConfig(tempDir);
      
      expect(config.formats).toEqual(['webp']);
      expect(config.quality.webp).toBe(90);
      // Should still have defaults for unspecified values
      expect(config.quality.avif).toBe(80);
      expect(config.generateThumbnails).toBe(true);
    });
    
    it('should handle malformed JSON gracefully', async () => {
      await fs.writeFile(
        path.join(tempDir, '.imagerc'),
        '{ invalid json }'
      );
      
      await expect(configLoader.loadConfig(tempDir))
        .rejects.toThrow('Invalid JSON in .imagerc');
    });
    
    it('should handle file read errors gracefully', async () => {
      // Create a directory with the config file name to trigger read error
      await fs.mkdir(path.join(tempDir, '.imagerc'));
      
      const config = await configLoader.loadConfig(tempDir);
      
      // Should return defaults when file can't be read
      expect(config.formats).toEqual(['webp', 'avif', 'original']);
    });
    
    it('should support .imagerc.json as alternative name', async () => {
      const customConfig = {
        formats: ['avif', 'original']
      };
      
      await fs.writeFile(
        path.join(tempDir, '.imagerc.json'),
        JSON.stringify(customConfig)
      );
      
      const config = await configLoader.loadConfig(tempDir);
      
      expect(config.formats).toEqual(['avif', 'original']);
    });
    
    it('should prefer .imagerc over .imagerc.json', async () => {
      await fs.writeFile(
        path.join(tempDir, '.imagerc'),
        JSON.stringify({ formats: ['webp'] })
      );
      
      await fs.writeFile(
        path.join(tempDir, '.imagerc.json'),
        JSON.stringify({ formats: ['avif'] })
      );
      
      const config = await configLoader.loadConfig(tempDir);
      
      expect(config.formats).toEqual(['webp']);
    });
  });
  
  describe('validateConfig', () => {
    it('should accept valid configuration', () => {
      const validConfig = {
        formats: ['webp', 'avif'],
        quality: {
          webp: 85,
          avif: 75,
          jpeg: 90
        },
        outputDir: 'images/optimized',
        generateThumbnails: false,
        thumbnailWidth: 150,
        preserveMetadata: true
      };
      
      expect(() => configLoader.validateConfig(validConfig)).not.toThrow();
    });
    
    it('should reject invalid format values', () => {
      const invalidConfig = {
        formats: ['webp', 'invalid-format']
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('Invalid format: invalid-format');
    });
    
    it('should reject empty formats array', () => {
      const invalidConfig = {
        formats: []
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('At least one output format must be specified');
    });
    
    it('should reject quality values outside 1-100 range', () => {
      const invalidConfig = {
        quality: {
          webp: 101
        }
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('Quality for webp must be between 1 and 100');
    });
    
    it('should reject negative quality values', () => {
      const invalidConfig = {
        quality: {
          avif: -5
        }
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('Quality for avif must be between 1 and 100');
    });
    
    it('should reject invalid thumbnail width', () => {
      const invalidConfig = {
        thumbnailWidth: 5
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('Thumbnail width must be between 10 and 1000');
    });
    
    it('should reject empty output directory', () => {
      const invalidConfig = {
        outputDir: ''
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('Output directory cannot be empty');
    });
    
    it('should accept partial configuration', () => {
      const partialConfig = {
        quality: {
          webp: 95
        }
      };
      
      expect(() => configLoader.validateConfig(partialConfig)).not.toThrow();
    });
    
    it('should accept valid quality rules', () => {
      const configWithRules = {
        qualityRules: [
          {
            pattern: '*-hero.*',
            quality: { webp: 95, avif: 90 }
          },
          {
            directory: 'products/',
            quality: { webp: 70 }
          },
          {
            minWidth: 3000,
            quality: { jpeg: 95 }
          }
        ]
      };
      
      expect(() => configLoader.validateConfig(configWithRules)).not.toThrow();
    });
    
    it('should reject quality rules without criteria', () => {
      const invalidConfig = {
        qualityRules: [
          {
            quality: { webp: 90 }
          }
        ]
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('qualityRules[0] must have at least one matching criteria');
    });
    
    it('should reject quality rules with invalid quality values', () => {
      const invalidConfig = {
        qualityRules: [
          {
            pattern: '*.jpg',
            quality: { jpeg: 101 }
          }
        ]
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('qualityRules[0].quality.jpeg must be between 1 and 100');
    });
    
    it('should reject non-array qualityRules', () => {
      const invalidConfig = {
        qualityRules: { pattern: '*.jpg', quality: { jpeg: 90 } }
      };
      
      expect(() => configLoader.validateConfig(invalidConfig))
        .toThrow('qualityRules must be an array');
    });
  });
  
  describe('mergeConfigs', () => {
    const defaults = {
      formats: ['webp', 'avif', 'original'],
      quality: {
        webp: 80,
        avif: 80,
        jpeg: 80
      },
      outputDir: 'optimized',
      generateThumbnails: true,
      thumbnailWidth: 200,
      preserveMetadata: false
    };
    
    it('should return defaults when no overrides provided', () => {
      const merged = configLoader.mergeConfigs(defaults, {}, {});
      
      expect(merged).toEqual(defaults);
    });
    
    it('should override defaults with file config', () => {
      const fileConfig = {
        formats: ['webp'],
        quality: {
          webp: 90
        }
      };
      
      const merged = configLoader.mergeConfigs(defaults, fileConfig, {});
      
      expect(merged.formats).toEqual(['webp']);
      expect(merged.quality.webp).toBe(90);
      expect(merged.quality.avif).toBe(80); // unchanged
    });
    
    it('should override file config with CLI args', () => {
      const fileConfig = {
        formats: ['webp'],
        quality: {
          webp: 90
        }
      };
      
      const cliArgs = {
        formats: ['avif', 'original'],
        quality: {
          webp: 95
        }
      };
      
      const merged = configLoader.mergeConfigs(defaults, fileConfig, cliArgs);
      
      expect(merged.formats).toEqual(['avif', 'original']); // CLI wins
      expect(merged.quality.webp).toBe(95); // CLI wins
    });
    
    it('should deep merge quality objects', () => {
      const fileConfig = {
        quality: {
          webp: 85
        }
      };
      
      const cliArgs = {
        quality: {
          avif: 75
        }
      };
      
      const merged = configLoader.mergeConfigs(defaults, fileConfig, cliArgs);
      
      expect(merged.quality).toEqual({
        webp: 85,  // from file
        avif: 75,  // from CLI
        jpeg: 80   // from defaults
      });
    });
    
    it('should handle boolean overrides correctly', () => {
      const fileConfig = {
        generateThumbnails: false,
        preserveMetadata: true
      };
      
      const cliArgs = {
        generateThumbnails: true
      };
      
      const merged = configLoader.mergeConfigs(defaults, fileConfig, cliArgs);
      
      expect(merged.generateThumbnails).toBe(true); // CLI wins
      expect(merged.preserveMetadata).toBe(true); // from file
    });
  });
});