class ConfigLoader {
  constructor(dependencies = {}) {
    // Inject dependencies with defaults
    this.fs = dependencies.fs || require('fs').promises;
    this.path = dependencies.path || require('path');
    
    this.defaultConfig = {
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
    
    this.validFormats = ['webp', 'avif', 'original', 'jpeg', 'png'];
  }
  
  async loadConfig(projectRoot = process.cwd(), cliArgs = {}) {
    let fileConfig = {};
    
    // Try to load config file
    const configPath = await this.findConfigFile(projectRoot);
    if (configPath) {
      try {
        const configContent = await this.fs.readFile(configPath, 'utf8');
        try {
          fileConfig = JSON.parse(configContent);
        } catch (parseError) {
          throw new Error(`Invalid JSON in .imagerc: ${parseError.message}`);
        }
      } catch (error) {
        if (error.message.includes('Invalid JSON')) {
          throw error;
        }
        // File read error - use defaults
        fileConfig = {};
      }
    }
    
    // Merge configurations
    const merged = this.mergeConfigs(this.defaultConfig, fileConfig, cliArgs);
    
    // Validate the final configuration
    this.validateConfig(merged);
    
    return merged;
  }
  
  async findConfigFile(projectRoot) {
    const configNames = ['.imagerc', '.imagerc.json'];
    
    for (const configName of configNames) {
      const configPath = this.path.join(projectRoot, configName);
      try {
        const stats = await this.fs.stat(configPath);
        if (stats.isFile()) {
          return configPath;
        }
      } catch {
        // File doesn't exist or can't be accessed
        continue;
      }
    }
    
    return null;
  }
  
  validateConfig(config) {
    // Validate formats
    if (config.formats !== undefined) {
      if (!Array.isArray(config.formats)) {
        throw new Error('formats must be an array');
      }
      
      if (config.formats.length === 0) {
        throw new Error('At least one output format must be specified');
      }
      
      for (const format of config.formats) {
        if (!this.validFormats.includes(format)) {
          throw new Error(`Invalid format: ${format}. Valid formats are: ${this.validFormats.join(', ')}`);
        }
      }
    }
    
    // Validate quality values
    if (config.quality !== undefined) {
      const qualityFormats = ['webp', 'avif', 'jpeg'];
      for (const format of qualityFormats) {
        if (config.quality[format] !== undefined) {
          const quality = config.quality[format];
          if (typeof quality !== 'number' || quality < 1 || quality > 100) {
            throw new Error(`Quality for ${format} must be between 1 and 100`);
          }
        }
      }
    }
    
    // Validate thumbnail width
    if (config.thumbnailWidth !== undefined) {
      if (typeof config.thumbnailWidth !== 'number' || 
          config.thumbnailWidth < 10 || 
          config.thumbnailWidth > 1000) {
        throw new Error('Thumbnail width must be between 10 and 1000');
      }
    }
    
    // Validate output directory
    if (config.outputDir !== undefined) {
      if (typeof config.outputDir !== 'string' || config.outputDir.trim() === '') {
        throw new Error('Output directory cannot be empty');
      }
    }
    
    // Validate metadata preservation
    if (config.preserveMetadata !== undefined) {
      if (typeof config.preserveMetadata === 'boolean') {
        // Valid boolean
      } else if (typeof config.preserveMetadata === 'object' && config.preserveMetadata !== null) {
        // Validate object fields
        const validFields = ['copyright', 'creator', 'datetime', 'camera', 'gps', 'all'];
        for (const key in config.preserveMetadata) {
          if (!validFields.includes(key)) {
            throw new Error(`Invalid metadata field: ${key}. Valid fields are: ${validFields.join(', ')}`);
          }
          if (typeof config.preserveMetadata[key] !== 'boolean') {
            throw new Error(`Metadata field ${key} must be a boolean`);
          }
        }
      } else {
        throw new Error('preserveMetadata must be a boolean or an object');
      }
    }
    
    // Validate quality rules
    if (config.qualityRules !== undefined) {
      if (!Array.isArray(config.qualityRules)) {
        throw new Error('qualityRules must be an array');
      }
      
      config.qualityRules.forEach((rule, index) => {
        if (typeof rule !== 'object' || rule === null) {
          throw new Error(`qualityRules[${index}] must be an object`);
        }
        
        // At least one matching criteria required
        if (!rule.pattern && !rule.directory && !rule.minWidth && !rule.minHeight && 
            !rule.maxWidth && !rule.maxHeight) {
          throw new Error(`qualityRules[${index}] must have at least one matching criteria`);
        }
        
        // Validate pattern
        if (rule.pattern !== undefined && typeof rule.pattern !== 'string') {
          throw new Error(`qualityRules[${index}].pattern must be a string`);
        }
        
        // Validate directory
        if (rule.directory !== undefined && typeof rule.directory !== 'string') {
          throw new Error(`qualityRules[${index}].directory must be a string`);
        }
        
        // Validate size constraints
        const sizeProps = ['minWidth', 'minHeight', 'maxWidth', 'maxHeight'];
        for (const prop of sizeProps) {
          if (rule[prop] !== undefined) {
            if (typeof rule[prop] !== 'number' || rule[prop] <= 0) {
              throw new Error(`qualityRules[${index}].${prop} must be a positive number`);
            }
          }
        }
        
        // Validate quality object
        if (!rule.quality || typeof rule.quality !== 'object') {
          throw new Error(`qualityRules[${index}].quality must be an object`);
        }
        
        // Validate quality values
        for (const format in rule.quality) {
          const value = rule.quality[format];
          if (typeof value !== 'number' || value < 1 || value > 100) {
            throw new Error(`qualityRules[${index}].quality.${format} must be between 1 and 100`);
          }
        }
      });
    }
  }
  
  mergeConfigs(defaults, fileConfig, cliArgs) {
    // Deep merge objects
    const merged = { ...defaults };
    
    // Merge file config
    for (const key in fileConfig) {
      if (key === 'quality' && typeof fileConfig[key] === 'object') {
        merged[key] = { ...merged[key], ...fileConfig[key] };
      } else {
        merged[key] = fileConfig[key];
      }
    }
    
    // Merge CLI args (highest priority)
    for (const key in cliArgs) {
      if (key === 'quality' && typeof cliArgs[key] === 'object') {
        merged[key] = { ...merged[key], ...cliArgs[key] };
      } else {
        merged[key] = cliArgs[key];
      }
    }
    
    return merged;
  }
}

module.exports = ConfigLoader;