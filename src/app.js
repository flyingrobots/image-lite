const fs = require('fs').promises;
const path = require('path');

class ImageOptimizerApp {
  constructor({
    config,
    progressManager,
    errorRecoveryManager,
    qualityRulesEngine,
    optimizer,
    logger,
    inputDir = 'original'
  }) {
    this.config = config;
    this.progressManager = progressManager;
    this.errorRecoveryManager = errorRecoveryManager;
    this.qualityRulesEngine = qualityRulesEngine;
    this.optimizer = optimizer;
    this.logger = logger;
    this.inputDir = inputDir;
  }

  async processImages(options = {}) {
    const { forceReprocess, pullLfs, continueOnError, resumeFlag } = options;
    
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
      
      const imageFiles = await this._findImageFiles(this.inputDir);
      
      if (imageFiles.length === 0) {
        this.logger.log('No images found in the original directory');
        return { processed: 0, skipped: 0, errors: 0, lfsPointers: 0, lfsErrors: 0 };
      }
      
      this.progressManager.start(imageFiles.length);
      
      this.logger.log(`Found ${imageFiles.length} images to process...`);
      if (forceReprocess) {
        this.logger.log('Force reprocessing enabled - all images will be regenerated');
      }
      if (pullLfs) {
        this.logger.log('Git LFS auto-pull enabled - pointer files will be downloaded');
      }
      this.logger.log('');
      
      const stats = {
        processed: 0,
        skipped: 0,
        errors: 0,
        lfsPointers: 0,
        lfsErrors: 0
      };
      
      const savedState = await this.errorRecoveryManager.loadState();
      let startIndex = 0;
      
      if (resumeFlag && savedState) {
        // Handle both old and new state formats
        startIndex = savedState.checkpoint?.processedCount || savedState.progress?.processed || 0;
        if (startIndex > 0) {
          this.logger.log(`📂 Resuming from previous state... (starting at image ${startIndex + 1})`);
        }
      }
      
      const filesToProcess = imageFiles.slice(startIndex);
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        
        this.progressManager.setFilename(file);
        
        try {
          const imageQuality = await this.qualityRulesEngine.getQualityForImage(
            path.join(this.inputDir, file)
          );
          
          const mergedQuality = {
            ...this.config.quality,
            ...imageQuality
          };
          
          const result = await this.optimizer.optimizeImage(
            path.join(this.inputDir, file), 
            file,
            { 
              forceReprocess, 
              pullLfs,
              quality: mergedQuality
            }
          );
          
          this._updateStats(stats, result, file);
          
          if (result === 'error') {
            // Log the error even if continuing on error
            const error = new Error(`Failed to process ${file}`);
            await this.errorRecoveryManager.logError(file, error, { type: 'processing_error' });
            
            if (!continueOnError) {
              throw error;
            }
          }
          
          this.errorRecoveryManager.recordProcessedFile(file, { status: result });
          
          if (i % 10 === 0) {
            await this.errorRecoveryManager.saveState({ 
              processedCount: i + 1,
              totalCount: imageFiles.length 
            });
          }
          
        } catch (error) {
          stats.errors++;
          this.progressManager.increment({ status: 'error', filename: file });
          await this.errorRecoveryManager.logError(file, error, { type: 'processing_error' });
          
          if (!continueOnError) {
            throw error;
          }
        }
      }
      
      this.progressManager.finish(false);
      
      if (stats.errors === 0) {
        await this.errorRecoveryManager.clearState();
      } else {
        await this.errorRecoveryManager.saveState({ 
          processedCount: imageFiles.length,
          totalCount: imageFiles.length 
        });
      }
      
      return stats;
      
    } catch (error) {
      this.progressManager.finish();
      this.logger.error('Fatal error:', error);
      await this.errorRecoveryManager.logError('FATAL', error, { type: 'fatal' });
      throw error;
    }
  }

  async _findImageFiles(dir, relativePath = '') {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativeFilePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await this._findImageFiles(fullPath, relativeFilePath);
        files.push(...subFiles);
      } else if (entry.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(entry.name)) {
        files.push(relativeFilePath);
      }
    }
    
    return files;
  }

  watchForChanges(options = {}) {
    const { pullLfs } = options;
    const chokidar = require('chokidar');
    
    this.logger.log('👀 Watching for changes in the original directory...');
    this.logger.log('Press Ctrl+C to stop\n');
    
    const watcher = chokidar.watch(this.inputDir, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    const processFile = async (filePath, action) => {
      const file = path.basename(filePath);
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
        return;
      }
      
      this.logger.log(`\n${action === 'add' ? '📸 New' : '🔄'} image ${action === 'add' ? 'detected' : 'changed'}: ${file}`);
      
      try {
        const imageQuality = await this.qualityRulesEngine.getQualityForImage(filePath);
        const mergedQuality = {
          ...this.config.quality,
          ...imageQuality
        };
        
        const result = await this.optimizer.optimizeImage(
          filePath,
          file,
          { 
            forceReprocess: true,
            pullLfs,
            quality: mergedQuality
          }
        );
        
        if (result === 'processed') {
          this.logger.log(`✅ ${action === 'add' ? 'Optimized' : 'Re-optimized'} ${file}`);
        } else if (result === 'error') {
          this.logger.error(`❌ Failed to optimize ${file}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error processing ${file}:`, error.message);
      }
    };
    
    watcher.on('add', filePath => processFile(filePath, 'add'));
    watcher.on('change', filePath => processFile(filePath, 'change'));
    watcher.on('error', error => this.logger.error('❌ Watcher error:', error));
    
    return watcher;
  }

  showSummary(stats, quietMode, errorLog) {
    if (!quietMode) {
      this.logger.log('\n' + '='.repeat(50));
      this.logger.log('✅ Optimization complete!');
      this.logger.log(`   Processed: ${stats.processed} images`);
      this.logger.log(`   Skipped: ${stats.skipped} images (already up to date)`);
      if (stats.lfsPointers > 0) {
        this.logger.log(`   Git LFS pointers: ${stats.lfsPointers} files (use --pull-lfs flag)`);
      }
      if (stats.lfsErrors > 0) {
        this.logger.log(`   Git LFS errors: ${stats.lfsErrors} files`);
      }
      if (stats.errors > 0) {
        this.logger.log(`   Errors: ${stats.errors} images`);
        this.logger.log(`   Error details logged to: ${errorLog}`);
      }
      this.logger.log('='.repeat(50));
    }
  }

  _updateStats(stats, result, file) {
    switch (result) {
      case 'processed': 
        stats.processed++; 
        this.progressManager.increment({ status: 'processed', filename: file });
        break;
      case 'skipped': 
        stats.skipped++; 
        this.progressManager.increment({ status: 'skipped', filename: file });
        break;
      case 'error': 
        stats.errors++; 
        this.progressManager.increment({ status: 'error', filename: file });
        break;
      case 'lfs-pointer': 
        stats.lfsPointers++; 
        this.progressManager.increment({ status: 'skipped', filename: file });
        break;
      case 'lfs-error': 
        stats.lfsErrors++; 
        this.progressManager.increment({ status: 'error', filename: file });
        break;
    }
  }
}

module.exports = ImageOptimizerApp;