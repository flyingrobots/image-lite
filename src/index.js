const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Export the main app for batch processing
const ImageLiteApp = require('./app');

// Export core modules for advanced usage
const ImageProcessor = require('./core/image-processor');
const ImageLite = require('./core/image-lite');

/**
 * Optimize a single image file
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path for output image
 * @param {Object} options - Optimization options
 * @param {string} options.format - Output format (webp, avif, jpeg, png, auto)
 * @param {number} options.quality - Quality (1-100)
 * @param {Object} options.resize - Resize options {width, height}
 * @param {boolean} options.preserveMetadata - Keep EXIF data
 * @returns {Promise<Object>} Result object with success status and metadata
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Start with the input image
    let pipeline = sharp(inputPath);

    // Auto-rotate based on EXIF orientation
    pipeline = pipeline.rotate();

    // Preserve metadata if requested
    if (options.preserveMetadata) {
      pipeline = pipeline.withMetadata();
    }

    // Resize if specified
    if (options.resize) {
      pipeline = pipeline.resize(options.resize.width, options.resize.height, {
        withoutEnlargement: true,
        fit: options.resize.fit || 'inside'
      });
    }

    // Determine output format
    let format = options.format;
    if (!format || format === 'auto') {
      // Auto-detect from output path
      const ext = path.extname(outputPath).toLowerCase();
      format = ext.slice(1); // Remove the dot
    }

    // Apply format-specific options
    const quality = options.quality || 85;
    switch (format) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Process and save
    const info = await pipeline.toFile(outputPath);

    return {
      success: true,
      inputPath,
      outputPath,
      format,
      size: info.size,
      width: info.width,
      height: info.height,
      reduction: null // Will be calculated if we have input size
    };

  } catch (error) {
    return {
      success: false,
      inputPath,
      outputPath,
      error: error.message
    };
  }
}

/**
 * Get image metadata without processing
 * @param {string} imagePath - Path to image file
 * @returns {Promise<Object>} Image metadata
 */
async function getImageMetadata(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    const stats = await fs.stat(imagePath);
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      density: metadata.density
    };
  } catch (error) {
    throw new Error(`Failed to read metadata: ${error.message}`);
  }
}

module.exports = {
  // Single file operations
  optimizeImage,
  getImageMetadata,
  
  // Batch processing
  ImageLiteApp,
  
  // Core modules for advanced usage
  ImageProcessor,
  ImageLite
};