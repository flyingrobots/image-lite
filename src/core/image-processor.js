class ImageProcessor {
  constructor(sharp, config = {}) {
    this.sharp = sharp;
    this.config = config;
  }

  async processImage(inputPath, outputConfigs) {
    // Create base image processor
    let image = this.sharp(inputPath).rotate();
    
    // Apply metadata configuration
    if (this.config.preserveMetadata === false) {
      // Don't add withMetadata - Sharp strips by default
    } else if (this.config.preserveMetadata === true) {
      // Preserve all metadata
      image = image.withMetadata();
    } else if (typeof this.config.preserveMetadata === 'object') {
      // Selective preservation - for now, treat as preserve all
      // TODO: Implement selective preservation
      image = image.withMetadata();
    } else {
      // Default behavior - strip metadata
    }

    const results = [];
    
    for (const config of outputConfigs) {
      try {
        const processor = image.clone();
        
        if (config.resize) {
          processor.resize(config.resize.width, config.resize.height, {
            withoutEnlargement: true,
            fit: config.resize.fit || 'inside'
          });
        }

        await processor[config.format](config.options).toFile(config.outputPath);
        results.push({ path: config.outputPath, success: true });
      } catch (error) {
        results.push({ path: config.outputPath, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = ImageProcessor;