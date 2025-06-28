const OutputPathGenerator = require('../../src/utils/output-path-generator');

describe('OutputPathGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new OutputPathGenerator('/output');
  });

  describe('generatePaths', () => {
    it('should generate correct paths for PNG files', () => {
      const paths = generator.generatePaths('test-image.png');
      
      expect(paths).toEqual({
        webp: '/output/test-image.webp',
        avif: '/output/test-image.avif',
        original: '/output/test-image.png',
        thumbnail: '/output/test-image-thumb.webp'
      });
    });

    it('should generate correct paths for JPEG files', () => {
      const paths = generator.generatePaths('photo.jpg');
      
      expect(paths).toEqual({
        webp: '/output/photo.webp',
        avif: '/output/photo.avif',
        original: '/output/photo.jpg',
        thumbnail: '/output/photo-thumb.webp'
      });
    });

    it('should handle uppercase extensions', () => {
      const paths = generator.generatePaths('IMAGE.PNG');
      
      expect(paths.original).toBe('/output/IMAGE.png');
    });
  });

  describe('getProcessingConfigs', () => {
    it('should generate PNG processing configs', () => {
      const paths = {
        webp: '/output/test.webp',
        avif: '/output/test.avif',
        original: '/output/test.png',
        thumbnail: '/output/test-thumb.webp'
      };
      
      const configs = generator.getProcessingConfigs('test.png', paths);
      
      expect(configs).toHaveLength(4);
      expect(configs[2]).toMatchObject({
        outputPath: '/output/test.png',
        format: 'png',
        options: { compressionLevel: 9 }
      });
    });

    it('should generate JPEG processing configs', () => {
      const paths = {
        webp: '/output/test.webp',
        avif: '/output/test.avif',
        original: '/output/test.jpg',
        thumbnail: '/output/test-thumb.webp'
      };
      
      const configs = generator.getProcessingConfigs('test.jpg', paths);
      
      expect(configs[2]).toMatchObject({
        outputPath: '/output/test.jpg',
        format: 'jpeg',
        options: { quality: 90 }
      });
    });
  });
});