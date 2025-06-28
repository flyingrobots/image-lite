<div align="center">
  <img src="./image-lite.webp" alt="image-lite logo" width="300">
</div>

# image-lite

A high-performance batch image optimization tool built with Node.js and Sharp. Optimize thousands of images efficiently with support for modern formats (WebP, AVIF), automatic format conversion, and intelligent quality rules.

## Features

- 🚀 **High Performance** - Built on Sharp, the fastest Node.js image processing library
- 🎯 **Smart Optimization** - Automatic format selection and quality optimization
- 📦 **Batch Processing** - Process entire directories with subdirectory support
- 🔄 **Multiple Formats** - Generate WebP, AVIF, and optimized originals
- 🖼️ **Thumbnails** - Automatic thumbnail generation with configurable sizes
- 📏 **Quality Rules** - Per-image quality settings based on patterns
- 🔧 **Flexible Config** - JSON/YAML configuration with sensible defaults
- 📊 **Progress Tracking** - Real-time progress bars and detailed statistics
- 🛡️ **Error Recovery** - Resume interrupted jobs and retry failed images
- 🔌 **Git LFS Support** - Automatic Git LFS detection and pulling

## Installation

```bash
npm install -g image-lite
```

Or use directly with npx:

```bash
npx image-lite
```

## Quick Start

1. Create a directory structure:
   ```
   your-project/
   ├── original/       # Put your source images here
   └── optimized/      # Optimized images will be generated here
   ```

2. Add images to the `original/` directory

3. Run the optimizer:
   ```bash
   image-lite
   ```

## Usage

```bash
image-lite [options]

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
  --error-log=PATH     Path to error log file (default: image-lite-errors.log)
  --help, -h           Show help message
```

### Examples

```bash
# Process all new/modified images
image-lite

# Force reprocess all images
image-lite --force

# Watch for changes
image-lite --watch

# Continue on errors and log them
image-lite --continue-on-error --error-log=errors.log
```

## Configuration

Create a `.imagerc` or `.imagerc.json` file in your project root:

```json
{
  "outputDir": "optimized",
  "formats": ["original", "webp", "avif"],
  "generateThumbnails": true,
  "thumbnailWidth": 300,
  "preserveMetadata": false,
  "quality": {
    "jpeg": 85,
    "webp": 85,
    "avif": 80,
    "png": 90
  },
  "qualityRules": [
    {
      "pattern": "**/hero-*.{jpg,png}",
      "quality": { "jpeg": 95, "webp": 95 }
    },
    {
      "pattern": "**/thumbnail-*.{jpg,png}",
      "quality": { "jpeg": 70, "webp": 70 }
    }
  ]
}
```

### Configuration Options

- **outputDir** - Output directory for optimized images (default: "optimized")
- **formats** - Array of output formats: "original", "webp", "avif" (default: all)
- **generateThumbnails** - Generate thumbnail versions (default: true)
- **thumbnailWidth** - Maximum thumbnail width in pixels (default: 300)
- **preserveMetadata** - Keep EXIF data (default: false)
- **quality** - Default quality settings per format (1-100)
- **qualityRules** - Per-pattern quality overrides

### Quality Rules

Apply different quality settings based on file patterns:

```json
{
  "qualityRules": [
    {
      "pattern": "backgrounds/*.jpg",
      "quality": { "jpeg": 75, "webp": 75 }
    },
    {
      "pattern": "logos/*.png",
      "quality": { "png": 100, "webp": 95 }
    },
    {
      "pattern": "**/print-*.{jpg,png}",
      "quality": { "jpeg": 100, "webp": 100 }
    }
  ]
}
```

## Docker Usage

For isolated environments or CI/CD pipelines:

```bash
# Build the Docker image
docker compose build

# Run optimization
docker compose run --rm optimize

# Watch mode
docker compose run --rm optimize-watch

# With Git LFS support
docker compose run --rm optimize-lfs
```

## API Usage

### Single File Processing

Optimize individual images with a simple API:

```javascript
const { optimizeImage, getImageMetadata } = require('image-lite');

// Basic usage
const result = await optimizeImage(
  'input/photo.jpg',
  'output/photo.webp'
);

// With options
const result = await optimizeImage(
  'input/photo.jpg',
  'output/photo-optimized.jpg',
  {
    quality: 90,
    resize: { width: 1920, height: 1080 },
    preserveMetadata: false
  }
);

// Get image info without processing
const metadata = await getImageMetadata('input/photo.jpg');
console.log(metadata); // { width, height, format, size, ... }
```

### Batch Processing

For processing entire directories:

```javascript
const { ImageLiteApp } = require('image-lite');

async function optimizeImages() {
  const app = new ImageLiteApp({
    config: {
      outputDir: 'dist/images',
      formats: ['webp', 'original'],
      quality: { webp: 90 }
    },
    inputDir: 'src/images'
  });

  const stats = await app.processImages({
    forceReprocess: false,
    continueOnError: true
  });

  console.log(`Processed ${stats.processed} images`);
}
```

## Performance Tips

1. **Use WebP/AVIF** - Modern formats provide 25-50% better compression
2. **Adjust Quality** - 85% quality is usually indistinguishable from 100%
3. **Skip Metadata** - Removing EXIF data saves space
4. **Batch Processing** - Process images in bulk for better performance
5. **Use Patterns** - Apply appropriate quality based on image purpose

## Error Handling

image-lite includes robust error handling:

- **Automatic Retries** - Transient errors are retried with exponential backoff
- **Error Logging** - Detailed error logs with timestamps and file paths
- **Resume Capability** - Interrupt and resume large batch jobs
- **Graceful Degradation** - Continue processing other images on errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © J Kirby Ross

## Acknowledgments

Built with [Sharp](https://sharp.pixelplumbing.com/) - High performance Node.js image processing