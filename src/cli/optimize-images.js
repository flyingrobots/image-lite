#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
const minimatch = require('minimatch');
const { execSync } = require('child_process');

// App imports
const ImageLiteApp = require('../app');
const CliParser = require('./cli-parser');

// Core imports
const ImageLite = require('../core/image-lite');
const ImageProcessor = require('../core/image-processor');
const ProcessingConfigGenerator = require('../core/processing-config-generator');
const QualityRulesEngine = require('../core/quality-rules-engine');

// Config imports
const ConfigLoader = require('../config/config-loader');

// State imports
const ErrorRecoveryManager = require('../state/error-recovery-manager');

// Utils imports
const ProgressManager = require('../utils/progress-manager');
const OutputPathGenerator = require('../utils/output-path-generator');
const FileTimestampChecker = require('../utils/file-timestamp-checker');

// Git imports
const GitLfsDetector = require('../git/git-lfs-detector');
const GitLfsPuller = require('../git/git-lfs-puller');

const INPUT_DIR = 'original';

async function main() {
  try {
    // Parse CLI arguments
    const cliParser = new CliParser();
    const options = cliParser.parse();

    // Show help if requested
    if (cliParser.hasFlag('--help') || cliParser.hasFlag('-h')) {
      process.stdout.write(CliParser.getHelpText() + '\n');
      process.exit(0);
    }

    // Create logger
    const logger = {
      log: (...args) => {
        if (!options.quietMode) {
          process.stdout.write(args.join(' ') + '\n');
        }
      },
      error: (...args) => {
        process.stderr.write(args.join(' ') + '\n');
      }
    };
    
    // Load configuration
    const configLoader = new ConfigLoader(fs, path);
    const config = await configLoader.loadConfig();
    
    // Apply CLI overrides
    if (options.noThumbnails) {
      config.generateThumbnails = false;
    }
    
    // Create managers
    const progressManager = new ProgressManager(
      { quiet: options.quietMode },
      cliProgress,
      colors,
      process.stdout
    );
    
    const errorRecoveryManager = new ErrorRecoveryManager({
      continueOnError: options.continueOnError !== undefined ? options.continueOnError : (config.errorRecovery?.continueOnError !== undefined ? config.errorRecovery.continueOnError : true),
      maxRetries: config.errorRecovery?.maxRetries || options.maxRetries,
      retryDelay: config.errorRecovery?.retryDelay || options.retryDelay,
      exponentialBackoff: config.errorRecovery?.exponentialBackoff !== false,
      errorLog: config.errorRecovery?.errorLog || options.errorLog,
      resume: options.resumeFlag
    });
    
    // Create quality rules engine
    const qualityRulesEngine = new QualityRulesEngine(config.qualityRules || [], minimatch, path);
    
    // Create Git LFS components
    const gitLfsDetector = new GitLfsDetector({ readFile: fs.readFile });
    const gitLfsPuller = new GitLfsPuller({ 
      exec: execSync 
    });
    
    // Create file helpers
    const timestampChecker = new FileTimestampChecker({ stat: fs.stat });
    const pathGenerator = new OutputPathGenerator(config.outputDir);
    const processingConfigGenerator = new ProcessingConfigGenerator(config);
    
    // Create image processor and optimizer
    const imageProcessor = new ImageProcessor(sharp, config);
    const optimizer = new ImageLite({
      ...config,
      gitLfsDetector,
      gitLfsPuller,
      timestampChecker,
      imageProcessor,
      pathGenerator,
      processingConfigGenerator,
      fileOperations: { copyFile: fs.copyFile },
      logger
    });
    
    // Create application
    const app = new ImageLiteApp({
      config,
      progressManager,
      errorRecoveryManager,
      qualityRulesEngine,
      optimizer,
      logger,
      inputDir: INPUT_DIR
    });
    
    // Resolve final options with config defaults
    const resolvedOptions = {
      ...options,
      continueOnError: options.continueOnError !== undefined ? options.continueOnError : (config.errorRecovery?.continueOnError !== undefined ? config.errorRecovery.continueOnError : true)
    };
    
    // Run the application
    if (options.watchMode) {
      // Run initial optimization
      const stats = await app.processImages(resolvedOptions);
      app.showSummary(stats, options.quietMode, options.errorLog);
      
      // Start watching
      await app.watchForChanges(resolvedOptions);
    } else {
      const stats = await app.processImages(resolvedOptions);
      app.showSummary(stats, options.quietMode, options.errorLog);
    }
    
  } catch (error) {
    process.stderr.write(`Failed to run image-lite: ${error}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`${err}\n`);
    process.exit(1);
  });
}

module.exports = { main };