const QualityRulesEngine = require('../../src/quality-rules-engine');

describe('QualityRulesEngine', () => {
  let engine;
  
  describe('Basic rule matching', () => {
    beforeEach(() => {
      const rules = [
        {
          pattern: '*-hero.*',
          quality: { webp: 95, avif: 90 }
        },
        {
          directory: 'products/',
          quality: { webp: 70 }
        },
        {
          minWidth: 3000,
          quality: { jpeg: 95 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should match pattern rules', () => {
      const quality = engine.getQualityForImage(
        'images/banner-hero.png',
        null,
        { webp: 80, avif: 80, jpeg: 80 }
      );
      
      expect(quality).toEqual({
        webp: 95,
        avif: 90,
        jpeg: 80
      });
    });
    
    it('should match directory rules', () => {
      const quality = engine.getQualityForImage(
        'products/widget.png',
        null,
        { webp: 80, avif: 80, jpeg: 80 }
      );
      
      expect(quality).toEqual({
        webp: 70,  // Directory rule overrides default
        avif: 80,  // Not specified in rule, keeps default
        jpeg: 80   // Not specified in rule, keeps default
      });
    });
    
    it('should match size rules', () => {
      const quality = engine.getQualityForImage(
        'photos/large.jpg',
        { width: 4000, height: 3000 },
        { webp: 80, avif: 80, jpeg: 80 }
      );
      
      expect(quality).toEqual({
        webp: 80,
        avif: 80,
        jpeg: 95
      });
    });
    
    it('should return default quality when no rules match', () => {
      const quality = engine.getQualityForImage(
        'random/file.png',
        { width: 100, height: 100 },
        { webp: 80, avif: 80, jpeg: 80 }
      );
      
      expect(quality).toEqual({
        webp: 80,
        avif: 80,
        jpeg: 80
      });
    });
  });
  
  describe('Rule specificity', () => {
    beforeEach(() => {
      const rules = [
        {
          pattern: '*.png',
          quality: { webp: 70 }
        },
        {
          pattern: '*-hero.*',
          quality: { webp: 90 }
        },
        {
          pattern: '*-hero.*',
          directory: 'banners/',
          quality: { webp: 95 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should apply more specific rules over general ones', () => {
      const quality = engine.getQualityForImage(
        'banners/main-hero.png',
        null,
        { webp: 80 }
      );
      
      // Should match all three rules but apply most specific
      expect(quality.webp).toBe(95);
    });
    
    it('should prioritize more specific rules', () => {
      // Test that pattern+directory beats pattern-only
      const heroInBanners = engine.getQualityForImage('banners/page-hero.png', null, { webp: 50 });
      expect(heroInBanners.webp).toBe(95); // Most specific rule wins
      
      // Test that pattern-only beats generic pattern
      const heroElsewhere = engine.getQualityForImage('other/page-hero.png', null, { webp: 50 });
      expect(heroElsewhere.webp).toBe(90); // Medium specific rule wins
      
      // Test that generic pattern still applies
      const regularPng = engine.getQualityForImage('other/regular.png', null, { webp: 50 });
      expect(regularPng.webp).toBe(70); // Least specific rule wins
    });
  });
  
  describe('Complex rule combinations', () => {
    beforeEach(() => {
      const rules = [
        {
          pattern: '*-thumb.*',
          directory: 'products/',
          quality: { webp: 60, avif: 55 }
        },
        {
          minWidth: 2000,
          pattern: '*.jpg',
          quality: { jpeg: 90 }
        },
        {
          directory: 'products/premium/',
          quality: { webp: 85, avif: 80, jpeg: 85 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should handle multiple matching rules correctly', () => {
      const quality = engine.getQualityForImage(
        'products/premium/item-thumb.jpg',
        { width: 200, height: 200 },
        { webp: 80, avif: 80, jpeg: 80 }
      );
      
      // Should match rules 1 and 3, with rule 1 being more specific
      expect(quality).toEqual({
        webp: 60,  // From rule 1 (most specific)
        avif: 55,  // From rule 1
        jpeg: 85   // From rule 3 (rule 1 doesn't specify jpeg)
      });
    });
    
    it('should merge quality settings from multiple rules', () => {
      const quality = engine.getQualityForImage(
        'products/premium/large.jpg',
        { width: 3000, height: 2000 },
        { webp: 80, avif: 80, jpeg: 80 }
      );
      
      // Should match rules 2 and 3
      expect(quality).toEqual({
        webp: 85,  // From rule 3
        avif: 80,  // From rule 3
        jpeg: 90   // From rule 2 (more specific for jpeg)
      });
    });
  });
  
  describe('Directory matching', () => {
    beforeEach(() => {
      const rules = [
        {
          directory: 'assets/images/',
          quality: { webp: 75 }
        },
        {
          directory: 'assets/images/heroes/',
          quality: { webp: 90 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should match nested directories', () => {
      const quality = engine.getQualityForImage(
        'assets/images/heroes/banner.png',
        null,
        { webp: 80 }
      );
      
      // Should match both rules, but more specific wins
      expect(quality.webp).toBe(90);
    });
    
    it('should handle different path separators', () => {
      const quality = engine.getQualityForImage(
        'assets\\images\\heroes\\banner.png',
        null,
        { webp: 80 }
      );
      
      expect(quality.webp).toBe(90);
    });
    
    it('should not match partial directory names', () => {
      const quality = engine.getQualityForImage(
        'assets/images-backup/file.png',
        null,
        { webp: 80 }
      );
      
      // Should not match because 'images-backup' is not 'images/'
      expect(quality.webp).toBe(80);
    });
  });
  
  describe('Size-based rules', () => {
    beforeEach(() => {
      const rules = [
        {
          minWidth: 1920,
          minHeight: 1080,
          quality: { webp: 85 }
        },
        {
          maxWidth: 500,
          maxHeight: 500,
          quality: { webp: 60 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should match minimum size requirements', () => {
      const quality = engine.getQualityForImage(
        'image.png',
        { width: 2560, height: 1440 },
        { webp: 80 }
      );
      
      expect(quality.webp).toBe(85);
    });
    
    it('should match maximum size requirements', () => {
      const quality = engine.getQualityForImage(
        'thumbnail.png',
        { width: 300, height: 300 },
        { webp: 80 }
      );
      
      expect(quality.webp).toBe(60);
    });
    
    it('should not match when size requirements not met', () => {
      const quality = engine.getQualityForImage(
        'medium.png',
        { width: 1024, height: 768 },
        { webp: 80 }
      );
      
      expect(quality.webp).toBe(80);
    });
  });
  
  describe('Pattern matching', () => {
    beforeEach(() => {
      const rules = [
        {
          pattern: '*.{jpg,jpeg}',
          quality: { jpeg: 85 }
        },
        {
          pattern: 'IMG_*',
          quality: { webp: 75 }
        },
        {
          pattern: '*-{small,thumb,preview}.*',
          quality: { webp: 60, avif: 55 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should match file extensions', () => {
      const quality = engine.getQualityForImage(
        'photo.jpg',
        null,
        { jpeg: 80, webp: 80 }
      );
      
      expect(quality.jpeg).toBe(85);
    });
    
    it('should match prefix patterns', () => {
      const quality = engine.getQualityForImage(
        'IMG_001.png',
        null,
        { webp: 80 }
      );
      
      expect(quality.webp).toBe(75);
    });
    
    it('should match complex patterns', () => {
      const quality = engine.getQualityForImage(
        'product-thumb.png',
        null,
        { webp: 80, avif: 80 }
      );
      
      expect(quality).toEqual({
        webp: 60,
        avif: 55
      });
    });
    
    it('should be case-insensitive', () => {
      const quality = engine.getQualityForImage(
        'PHOTO.JPG',
        null,
        { jpeg: 80 }
      );
      
      expect(quality.jpeg).toBe(85);
    });
  });
  
  describe('explainMatch', () => {
    beforeEach(() => {
      const rules = [
        {
          pattern: '*-hero.*',
          directory: 'banners/',
          quality: { webp: 95 }
        },
        {
          minWidth: 2000,
          quality: { webp: 85 }
        }
      ];
      engine = new QualityRulesEngine(rules);
    });
    
    it('should explain which rules matched', () => {
      const explanation = engine.explainMatch(
        'banners/main-hero.png',
        { width: 3000, height: 2000 }
      );
      
      expect(explanation).toHaveLength(2);
      expect(explanation[0].criteria).toContain('pattern: *-hero.*');
      expect(explanation[0].criteria).toContain('directory: banners/');
      expect(explanation[1].criteria).toContain('minWidth: 2000');
    });
  });
});