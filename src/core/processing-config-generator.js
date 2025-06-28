const path = require('path');

class ProcessingConfigGenerator {
  constructor(config = {}) {
    this.defaultConfig = config;
  }

  generate(filename, paths, customConfig = {}) {
    const ext = path.parse(filename).ext.toLowerCase();
    const config = { ...this.defaultConfig, ...customConfig };
    
    const configs = [];
    
    // WebP format - skip WebP to WebP conversion
    if (config.formats?.includes('webp') && ext !== '.webp') {
      configs.push({
        outputPath: paths.webp,
        format: 'webp',
        options: { quality: config.quality?.webp || 85 },
        resize: config.resize || { width: 2000, height: 2000, withoutEnlargement: true, fit: 'inside' }
      });
    }
    
    // AVIF format
    if (config.formats?.includes('avif')) {
      configs.push({
        outputPath: paths.avif,
        format: 'avif',
        options: { quality: config.quality?.avif || 80 },
        resize: config.resize || { width: 2000, height: 2000, withoutEnlargement: true, fit: 'inside' }
      });
    }
    
    // Original format (optimized)
    if (config.formats?.includes('original') || 
        (ext === '.png' && config.formats?.includes('png')) ||
        ((ext === '.jpg' || ext === '.jpeg') && config.formats?.includes('jpeg'))) {
      const isJpeg = ext === '.jpg' || ext === '.jpeg';
      configs.push({
        outputPath: paths.original,
        format: isJpeg ? 'jpeg' : 'png',
        options: isJpeg 
          ? { quality: config.quality?.jpeg || 90 } 
          : { compressionLevel: 9 },
        resize: config.resize || { width: 2000, height: 2000, withoutEnlargement: true, fit: 'inside' }
      });
    }
    
    // Thumbnail - only generate if enabled and not restricted to original-only
    const isOriginalOnly = config.formats && config.formats.length === 1 && config.formats[0] === 'original';
    if (config.generateThumbnails && !isOriginalOnly) {
      configs.push({
        outputPath: paths.thumbnail,
        format: 'webp',
        options: { quality: config.quality?.thumbnail || 70 },
        resize: { 
          width: config.thumbnailWidth || 200, 
          height: config.thumbnailWidth || 200,
          withoutEnlargement: true,
          fit: 'cover'
        }
      });
    }
    
    return configs;
  }
}

module.exports = ProcessingConfigGenerator;