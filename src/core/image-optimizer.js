const path = require('path');
const fs = require('fs').promises;

class ImageOptimizer {
  constructor(config = {}) {
    // If config is passed directly, use it
    if (config.formats || config.quality || config.outputDir) {
      this.config = config;
      this.gitLfsDetector = config.gitLfsDetector;
      this.gitLfsPuller = config.gitLfsPuller;
      this.timestampChecker = config.timestampChecker;
      this.imageProcessor = config.imageProcessor;
      this.pathGenerator = config.pathGenerator;
      this.processingConfigGenerator = config.processingConfigGenerator;
      this.fileOperations = config.fileOperations;
      this.logger = config.logger;
    } else {
      // Legacy constructor with individual dependencies
      const {
        gitLfsDetector,
        gitLfsPuller,
        timestampChecker,
        imageProcessor,
        pathGenerator,
        processingConfigGenerator,
        fileOperations,
        logger
      } = config;
      
      this.gitLfsDetector = gitLfsDetector;
      this.gitLfsPuller = gitLfsPuller;
      this.timestampChecker = timestampChecker;
      this.imageProcessor = imageProcessor;
      this.pathGenerator = pathGenerator;
      this.processingConfigGenerator = processingConfigGenerator;
      this.fileOperations = fileOperations;
      this.logger = logger;
      
      // Default config
      this.config = {
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
    }
  }

  async optimizeImage(inputPath, filename, options = {}) {
    const ext = path.parse(filename).ext.toLowerCase();

    // Check for Git LFS pointer
    if (await this.gitLfsDetector.isGitLfsPointer(inputPath)) {
      if (options.pullLfs) {
        this.logger.log(`📥 Pulling LFS file: ${filename}`);
        const pullResult = await this.gitLfsPuller.pullFile(inputPath);
        
        if (!pullResult.success) {
          this.logger.log(`❌ Error pulling LFS file: ${filename} - ${pullResult.error}`);
          return 'lfs-error';
        }

        // Check again after pull
        if (await this.gitLfsDetector.isGitLfsPointer(inputPath)) {
          this.logger.log(`❌ Failed to pull LFS file: ${filename}`);
          return 'lfs-error';
        }
      } else {
        this.logger.log(`⚠️  Skipping ${filename} (Git LFS pointer file - use --pull-lfs flag or run 'git lfs pull')`);
        return 'lfs-pointer';
      }
    }

    // Generate output paths based on config
    const paths = this.generateConfiguredPaths(filename);
    const outputPaths = Object.values(paths);

    // Check if processing is needed
    const needsProcessing = await this.timestampChecker.shouldProcess(
      inputPath, 
      outputPaths, 
      options.forceReprocess
    );

    if (!needsProcessing) {
      this.logger.log(`⏭️  Skipping ${filename} (already up to date)`);
      return 'skipped';
    }

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(path.join(this.config.outputDir, filename));
      await fs.mkdir(outputDir, { recursive: true });
      
      // Handle special cases
      if (ext === '.gif') {
        await this.fileOperations.copyFile(inputPath, path.join(this.config.outputDir, filename));
        this.logger.log(`✅ Copied ${filename} (GIF files are not optimized)`);
        return 'processed';
      }


      // Generate output paths and processing configs
      const paths = this.pathGenerator.generatePaths(filename);
      const configs = this.processingConfigGenerator ? 
        this.processingConfigGenerator.generate(filename, paths, this.config) :
        this.getProcessingConfigs(filename, inputPath);
      
      if (configs.length > 0) {
        // Ensure output directory exists
        const outputDir = path.dirname(configs[0].outputPath);
        await fs.mkdir(outputDir, { recursive: true });
        
        const results = await this.imageProcessor.processImage(inputPath, configs);
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          throw new Error(`Failed to process ${filename}: ${failed[0].error}`);
        }
        this.logger.log(`✅ Optimized ${filename}`);
      }
      
      return 'processed';
    } catch (error) {
      this.logger.error(`❌ Error processing ${filename}: ${error.message}`);
      return 'error';
    }
  }
  
  generateConfiguredPaths(filename) {
    const name = path.parse(filename).name;
    const ext = path.parse(filename).ext.toLowerCase();
    const paths = {};
    
    // Generate paths based on configured formats
    if (this.config.formats.includes('webp')) {
      paths.webp = path.join(this.config.outputDir, `${name}.webp`);
    }
    
    if (this.config.formats.includes('avif')) {
      paths.avif = path.join(this.config.outputDir, `${name}.avif`);
    }
    
    if (this.config.formats.includes('original') || 
        this.config.formats.includes('jpeg') || 
        this.config.formats.includes('png')) {
      // Determine output extension
      let outputExt = ext;
      if (ext === '.jpeg' || ext === '.jpg') {
        outputExt = this.config.formats.includes('jpeg') ? '.jpg' : ext;
      } else if (ext === '.png') {
        outputExt = '.png';
      }
      paths.original = path.join(this.config.outputDir, `${name}${outputExt}`);
    }
    
    if (this.config.generateThumbnails) {
      paths.thumbnail = path.join(this.config.outputDir, `${name}-thumb.webp`);
    }
    
    return paths;
  }
  
  getProcessingConfigs(filename, _inputPath) {
    const name = path.parse(filename).name;
    const ext = path.parse(filename).ext.toLowerCase();
    const configs = [];
    
    // Add format-specific configs based on configuration
    // Skip WebP-to-WebP conversion (input WebP should only generate other formats)
    if (this.config.formats.includes('webp') && ext !== '.webp') {
      configs.push({
        outputPath: path.join(this.config.outputDir, `${name}.webp`),
        format: 'webp',
        options: { quality: this.config.quality.webp },
        resize: { width: 2000, height: 2000 }
      });
    }
    
    if (this.config.formats.includes('avif')) {
      configs.push({
        outputPath: path.join(this.config.outputDir, `${name}.avif`),
        format: 'avif',
        options: { quality: this.config.quality.avif },
        resize: { width: 2000, height: 2000 }
      });
    }
    
    if (this.config.formats.includes('original') || 
        (ext === '.png' && this.config.formats.includes('png')) ||
        ((ext === '.jpg' || ext === '.jpeg') && this.config.formats.includes('jpeg'))) {
      const isJpeg = ext === '.jpg' || ext === '.jpeg';
      configs.push({
        outputPath: path.join(this.config.outputDir, filename),
        format: isJpeg ? 'jpeg' : 'png',
        options: isJpeg ? { quality: this.config.quality.jpeg } : {},
        resize: { width: 2000, height: 2000 }
      });
    }
    
    if (this.config.generateThumbnails) {
      configs.push({
        outputPath: path.join(this.config.outputDir, `${name}-thumb.webp`),
        format: 'webp',
        options: { quality: this.config.quality.webp },
        resize: { width: this.config.thumbnailWidth, height: this.config.thumbnailWidth }
      });
    }
    
    return configs;
  }
}

module.exports = ImageOptimizer;