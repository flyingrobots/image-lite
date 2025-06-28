const path = require('path');

class OutputPathGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  generatePaths(filename, relativePath = '') {
    // Handle subdirectories in filename
    const dir = path.dirname(filename);
    const name = path.parse(filename).name;
    const ext = path.parse(filename).ext.toLowerCase();
    
    // Use subdirectory from filename if present, otherwise use relativePath
    const outputSubDir = (dir && dir !== '.') ? dir : (relativePath ? path.dirname(relativePath) : '');
    const fullOutputDir = path.join(this.outputDir, outputSubDir);

    return {
      webp: path.join(fullOutputDir, `${name}.webp`),
      avif: path.join(fullOutputDir, `${name}.avif`),
      original: path.join(fullOutputDir, `${name}${ext === '.png' ? '.png' : '.jpg'}`),
      thumbnail: path.join(fullOutputDir, `${name}-thumb.webp`)
    };
  }

  generateRelativePath(inputPath, baseDir) {
    return path.relative(baseDir, inputPath);
  }

  ensureOutputDirectory(outputPath) {
    return path.dirname(outputPath);
  }

  // Deprecated method for backward compatibility with tests
  getProcessingConfigs(filename, paths) {
    const ext = path.parse(filename).ext.toLowerCase();
    const configs = [];
    
    // Add WebP config (skip WebP-to-WebP conversion)
    if (ext !== '.webp') {
      configs.push({
        outputPath: paths.webp,
        format: 'webp',
        options: { quality: 85 },
        resize: { width: 2000, height: 2000 }
      });
    }
    
    // Add AVIF config
    configs.push({
      outputPath: paths.avif,
      format: 'avif',
      options: { quality: 80 },
      resize: { width: 2000, height: 2000 }
    });
    
    // Add original config for supported formats
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      configs.push({
        outputPath: paths.original,
        format: ext === '.png' ? 'png' : 'jpeg',
        options: ext === '.png' ? { compressionLevel: 9 } : { quality: 90 },
        resize: { width: 2000, height: 2000 }
      });
    }
    
    // Add thumbnail config
    configs.push({
      outputPath: paths.thumbnail,
      format: 'webp',
      options: { quality: 70 },
      resize: { width: 300, height: 300 }
    });
    
    return configs;
  }
}

module.exports = OutputPathGenerator;