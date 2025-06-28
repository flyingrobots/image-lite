const ImageProcessor = require('../../src/core/image-processor');

describe('ImageProcessor', () => {
  let processor;
  let mockSharp;
  let mockImage;

  beforeEach(() => {
    mockImage = {
      rotate: jest.fn().mockReturnThis(),
      withMetadata: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue()
    };
    
    // Mock sharp to return an object with rotate method
    mockSharp = jest.fn().mockImplementation(() => ({
      rotate: jest.fn().mockReturnValue(mockImage)
    }));
    processor = new ImageProcessor(mockSharp);
  });

  describe('processImage', () => {
    it('should process image with correct transformations', async () => {
      const configs = [
        {
          outputPath: '/output/image.webp',
          format: 'webp',
          options: { quality: 85 },
          resize: { width: 2000, height: 2000 }
        }
      ];

      const results = await processor.processImage('/input/image.png', configs);
      
      expect(mockSharp).toHaveBeenCalledWith('/input/image.png');
      // Since we changed the mock structure, we need to check differently
      const sharpInstance = mockSharp.mock.results[0].value;
      expect(sharpInstance.rotate).toHaveBeenCalled();
      // Default behavior: metadata should be stripped (no withMetadata call)
      expect(mockImage.withMetadata).not.toHaveBeenCalled();
      expect(mockImage.resize).toHaveBeenCalledWith(2000, 2000, {
        withoutEnlargement: true,
        fit: 'inside'
      });
      expect(mockImage.webp).toHaveBeenCalledWith({ quality: 85 });
      expect(mockImage.toFile).toHaveBeenCalledWith('/output/image.webp');
      
      expect(results).toEqual([
        { path: '/output/image.webp', success: true }
      ]);
    });

    it('should handle multiple output formats', async () => {
      const configs = [
        {
          outputPath: '/output/image.webp',
          format: 'webp',
          options: { quality: 85 }
        },
        {
          outputPath: '/output/image.avif',
          format: 'avif',
          options: { quality: 80 }
        }
      ];

      const results = await processor.processImage('/input/image.png', configs);
      
      expect(mockImage.clone).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should preserve metadata when configured', async () => {
      const processor = new ImageProcessor(mockSharp, { preserveMetadata: true });
      const configs = [{
        outputPath: '/output/image.webp',
        format: 'webp',
        options: { quality: 85 }
      }];
      
      await processor.processImage('/input/image.png', configs);
      
      expect(mockImage.withMetadata).toHaveBeenCalled();
    });
    
    it('should handle processing errors gracefully', async () => {
      mockImage.toFile.mockRejectedValueOnce(new Error('Write failed'));
      
      const configs = [
        {
          outputPath: '/output/image.webp',
          format: 'webp',
          options: { quality: 85 }
        }
      ];

      const results = await processor.processImage('/input/image.png', configs);
      
      expect(results).toEqual([
        { 
          path: '/output/image.webp', 
          success: false, 
          error: 'Write failed' 
        }
      ]);
    });
  });
});