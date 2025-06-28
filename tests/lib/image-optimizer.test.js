const ImageOptimizer = require('../../src/core/image-optimizer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('ImageOptimizer', () => {
  let tempDir;
  let inputDir;
  let outputDir;
  let optimizer;
  
  // Create actual test dependencies that behave like the real ones
  let testDependencies;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-optimizer-test-'));
    inputDir = path.join(tempDir, 'input');
    outputDir = path.join(tempDir, 'output');
    
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Create test dependencies with behavior-driven implementations
    testDependencies = {
      gitLfsDetector: {
        isGitLfsPointer: async filePath => {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            return content.startsWith('version https://git-lfs.github.com/spec/v1');
          } catch {
            return false;
          }
        }
      },
      gitLfsPuller: {
        pullFile: async filePath => {
          // Simulate pulling by replacing pointer with actual content
          const content = await fs.readFile(filePath, 'utf8');
          if (content.includes('oid sha256:fake')) {
            await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4E, 0x47])); // PNG header
            return { success: true };
          }
          return { success: false, error: 'Object not found' };
        }
      },
      timestampChecker: {
        shouldProcess: async (inputPath, outputPaths) => {
          try {
            const inputStats = await fs.stat(inputPath);
            for (const outputPath of Object.values(outputPaths)) {
              try {
                const outputStats = await fs.stat(outputPath);
                if (inputStats.mtime > outputStats.mtime) {
                  return true;
                }
              } catch {
                return true; // Output doesn't exist
              }
            }
            return false;
          } catch {
            return true;
          }
        }
      },
      imageProcessor: {
        processImage: async (inputPath, configs) => {
          // Simulate processing by creating output files
          const results = [];
          for (const config of configs) {
            await fs.writeFile(config.outputPath, `processed-${path.basename(config.outputPath)}`);
            results.push({ success: true, outputPath: config.outputPath });
          }
          return results;
        }
      },
      pathGenerator: {
        generatePaths: filename => {
          const base = path.basename(filename, path.extname(filename));
          const ext = path.extname(filename).toLowerCase();
          return {
            webp: path.join(outputDir, `${base}.webp`),
            avif: path.join(outputDir, `${base}.avif`),
            original: path.join(outputDir, `${base}${ext}`),
            thumbnail: path.join(outputDir, `${base}-thumb.webp`),
            directory: outputDir
          };
        }
      },
      processingConfigGenerator: {
        generate: (filename, paths, config) => {
          const ext = path.extname(filename).toLowerCase();
          const configs = [];
          
          // Match the actual config structure - skip WebP to WebP conversion
          if (config.formats?.includes('webp') && ext !== '.webp') {
            configs.push({ 
              outputPath: paths.webp, 
              format: 'webp',
              options: { quality: config.quality?.webp || 85 },
              resize: { width: 2000, height: 2000 }
            });
          }
          if (config.formats?.includes('avif')) {
            configs.push({ 
              outputPath: paths.avif, 
              format: 'avif',
              options: { quality: config.quality?.avif || 80 },
              resize: { width: 2000, height: 2000 }
            });
          }
          if (config.formats?.includes('original') || 
              (ext === '.png' && config.formats?.includes('png')) ||
              ((ext === '.jpg' || ext === '.jpeg') && config.formats?.includes('jpeg'))) {
            configs.push({ 
              outputPath: paths.original, 
              format: ext === '.png' ? 'png' : 'jpeg',
              options: ext === '.png' ? {} : { quality: 90 },
              resize: { width: 2000, height: 2000 }
            });
          }
          
          return configs;
        }
      },
      fileOperations: {
        copyFile: async (src, dest) => {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        }
      },
      logger: {
        log: () => {}, // Silent in tests
        error: () => {}
      }
    };
    
    // Add default config that matches actual usage
    const config = {
      formats: ['webp', 'avif', 'original'],
      quality: { webp: 85, avif: 80, jpeg: 90 },
      outputDir: outputDir,
      pullLfs: false,
      generateThumbnails: false,
      ...testDependencies
    };
    
    optimizer = new ImageOptimizer(config);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('optimizeImage', () => {
    it('should skip git-lfs pointer files when pullLfs is false', async () => {
      // Create a Git LFS pointer file
      const pointerPath = path.join(inputDir, 'file.png');
      await fs.writeFile(pointerPath, 'version https://git-lfs.github.com/spec/v1\noid sha256:fake\nsize 1234');
      
      const result = await optimizer.optimizeImage(pointerPath, 'file.png', { pullLfs: false });
      
      expect(result).toBe('lfs-pointer');
      // Verify no output files were created
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles).toHaveLength(0);
    });

    it('should pull and process git-lfs files when pullLfs is true', async () => {
      // Create a Git LFS pointer file
      const pointerPath = path.join(inputDir, 'file.png');
      await fs.writeFile(pointerPath, 'version https://git-lfs.github.com/spec/v1\noid sha256:fake\nsize 1234');
      
      const result = await optimizer.optimizeImage(pointerPath, 'file.png', { pullLfs: true });
      
      expect(result).toBe('processed');
      // Verify output files were created
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles).toContain('file.webp');
      expect(outputFiles).toContain('file.avif');
    });

    it('should handle failed git-lfs pulls', async () => {
      // Create a Git LFS pointer file with bad oid
      const pointerPath = path.join(inputDir, 'file.png');
      await fs.writeFile(pointerPath, 'version https://git-lfs.github.com/spec/v1\noid sha256:notfound\nsize 1234');
      
      const result = await optimizer.optimizeImage(pointerPath, 'file.png', { pullLfs: true });
      
      expect(result).toBe('lfs-error');
      // Verify no output files were created
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles).toHaveLength(0);
    });

    it('should skip files that are already up to date', async () => {
      // Create input file
      const inputPath = path.join(inputDir, 'file.png');
      await fs.writeFile(inputPath, 'fake-image-data');
      
      // Create output files with newer timestamps
      const paths = testDependencies.pathGenerator.generatePaths('file.png');
      await fs.writeFile(paths.webp, 'processed');
      await fs.writeFile(paths.avif, 'processed');
      await fs.writeFile(paths.original, 'processed');
      
      // Make output files newer than input
      const futureTime = new Date(Date.now() + 10000);
      await fs.utimes(paths.webp, futureTime, futureTime);
      await fs.utimes(paths.avif, futureTime, futureTime);
      await fs.utimes(paths.original, futureTime, futureTime);
      
      const result = await optimizer.optimizeImage(inputPath, 'file.png');
      
      expect(result).toBe('skipped');
      // Verify files weren't overwritten
      const webpContent = await fs.readFile(paths.webp, 'utf8');
      expect(webpContent).toBe('processed'); // Not changed
    });

    it('should copy GIF files without processing', async () => {
      // Create a GIF file
      const gifPath = path.join(inputDir, 'animation.gif');
      await fs.writeFile(gifPath, 'GIF89a-fake-data');
      
      const result = await optimizer.optimizeImage(gifPath, 'animation.gif');
      
      expect(result).toBe('processed');
      // Verify GIF was copied, not processed
      const outputPath = path.join(outputDir, 'animation.gif');
      const outputContent = await fs.readFile(outputPath, 'utf8');
      expect(outputContent).toBe('GIF89a-fake-data');
      
      // Verify no other formats were created
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles).toEqual(['animation.gif']);
    });

    it('should process WebP input files successfully', async () => {
      // Create a WebP file
      const webpPath = path.join(inputDir, 'image.webp');
      await fs.writeFile(webpPath, 'WEBP-fake-data');
      
      const result = await optimizer.optimizeImage(webpPath, 'image.webp');
      
      // Should successfully process the file
      expect(result).toBe('processed');
      
      // Should create at least one useful output format
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles.length).toBeGreaterThan(0);
      
      // Should create AVIF format (different from input)
      expect(outputFiles).toContain('image.avif');
    });

    it('should handle processing errors gracefully', async () => {
      // Override imageProcessor to simulate error
      testDependencies.imageProcessor.processImage = () => Promise.reject(new Error('Sharp error'));
      
      const imagePath = path.join(inputDir, 'file.png');
      await fs.writeFile(imagePath, 'fake-image-data');
      
      const result = await optimizer.optimizeImage(imagePath, 'file.png');
      
      expect(result).toBe('error');
      // Verify no output files were created
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles).toHaveLength(0);
    });

    it('should process normal images to all configured formats', async () => {
      // Create a JPG file
      const jpgPath = path.join(inputDir, 'photo.jpg');
      await fs.writeFile(jpgPath, 'JPEG-fake-data');
      
      const result = await optimizer.optimizeImage(jpgPath, 'photo.jpg');
      
      expect(result).toBe('processed');
      // Verify all formats were created
      const outputFiles = await fs.readdir(outputDir);
      expect(outputFiles).toContain('photo.webp');
      expect(outputFiles).toContain('photo.avif');
    });

    it('should create output directories as needed', async () => {
      // Create image in subdirectory
      const subDir = path.join(inputDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });
      const imagePath = path.join(subDir, 'nested.png');
      await fs.writeFile(imagePath, 'fake-image-data');
      
      // Override path generator to use subdirectories
      testDependencies.pathGenerator.generatePaths = relativePath => {
        const base = path.basename(relativePath, path.extname(relativePath));
        const ext = path.extname(relativePath).toLowerCase();
        const dir = path.dirname(relativePath);
        const fullOutputDir = path.join(outputDir, dir);
        return {
          webp: path.join(fullOutputDir, `${base}.webp`),
          avif: path.join(fullOutputDir, `${base}.avif`),
          original: path.join(fullOutputDir, `${base}${ext}`),
          thumbnail: path.join(fullOutputDir, `${base}-thumb.webp`),
          directory: fullOutputDir
        };
      };
      
      const result = await optimizer.optimizeImage(imagePath, 'subdir/nested.png');
      
      expect(result).toBe('processed');
      // Verify subdirectory was created
      const nestedOutputDir = path.join(outputDir, 'subdir');
      const outputFiles = await fs.readdir(nestedOutputDir);
      expect(outputFiles).toContain('nested.webp');
      expect(outputFiles).toContain('nested.avif');
    });
  });
});