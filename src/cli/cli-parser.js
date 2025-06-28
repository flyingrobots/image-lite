class CliParser {
  constructor(args = process.argv.slice(2)) {
    this.args = args;
  }

  parse() {
    const options = {
      forceReprocess: this.hasFlag('--force'),
      pullLfs: this.hasFlag('--pull-lfs'),
      noThumbnails: this.hasFlag('--no-thumbnails'),
      continueOnError: this.hasFlag('--continue-on-error'),
      resumeFlag: this.hasFlag('--resume'),
      quietMode: this.hasFlag('--quiet') || this.hasFlag('-q'),
      watchMode: this.hasFlag('--watch'),
      maxRetries: this.getIntValue('--max-retries=', 3),
      retryDelay: this.getIntValue('--retry-delay=', 1000),
      errorLog: this.getStringValue('--error-log=', 'image-optimization-errors.log')
    };

    return options;
  }

  hasFlag(flag) {
    return this.args.includes(flag);
  }

  getIntValue(prefix, defaultValue) {
    const arg = this.args.find(arg => arg.startsWith(prefix));
    return arg ? parseInt(arg.split('=')[1]) : defaultValue;
  }

  getStringValue(prefix, defaultValue) {
    const arg = this.args.find(arg => arg.startsWith(prefix));
    return arg ? arg.split('=')[1] : defaultValue;
  }

  static getHelpText() {
    return `
Image Optimization Tool

Usage: node src/cli/optimize-images.js [options]

Options:
  --force              Force reprocess all images, ignoring timestamps
  --pull-lfs           Automatically pull Git LFS files
  --no-thumbnails      Skip thumbnail generation
  --continue-on-error  Continue processing even if some images fail
  --resume             Resume from previous state (if interrupted)
  --quiet, -q          Suppress non-error output
  --watch              Watch for file changes and process automatically
  --max-retries=N      Maximum retry attempts for failed images (default: 3)
  --retry-delay=MS     Delay between retries in milliseconds (default: 1000)
  --error-log=PATH     Path to error log file (default: image-optimization-errors.log)
  --help, -h           Show this help message

Examples:
  # Process all new/modified images
  node src/cli/optimize-images.js

  # Force reprocess all images
  node src/cli/optimize-images.js --force

  # Watch for changes
  node src/cli/optimize-images.js --watch

  # Process with Git LFS support
  node scripts/optimize-images.js --pull-lfs

  # Quiet mode with error handling
  node scripts/optimize-images.js --quiet --continue-on-error
`;
  }
}

module.exports = CliParser;