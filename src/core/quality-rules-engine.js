class QualityRulesEngine {
  constructor(rules = [], dependencies = {}) {
    // Inject dependencies with defaults
    this.minimatch = dependencies.minimatch || require('minimatch').minimatch;
    this.path = dependencies.path || require('path');
    
    this.rules = this.sortRulesBySpecificity(rules);
  }

  /**
   * Get quality settings for a specific image based on matching rules
   * @param {string} imagePath - Path to the image file
   * @param {Object} metadata - Image metadata (width, height, etc.)
   * @param {Object} defaultQuality - Default quality settings to fall back to
   * @returns {Object} Merged quality settings
   */
  getQualityForImage(imagePath, metadata, defaultQuality = {}) {
    const matchingRules = this.rules.filter(rule => 
      this.ruleMatches(rule, imagePath, metadata)
    );
    
    // Start with default quality
    let mergedQuality = { ...defaultQuality };
    
    // Apply matching rules in order (least specific to most specific)
    // Since we sorted by specificity descending, we reverse to apply in ascending order
    const rulesToApply = [...matchingRules].reverse();
    
    for (const rule of rulesToApply) {
      if (rule.quality) {
        mergedQuality = {
          ...mergedQuality,
          ...rule.quality
        };
      }
    }
    
    return mergedQuality;
  }

  /**
   * Check if a rule matches the given image
   */
  ruleMatches(rule, imagePath, metadata) {
    // Pattern matching (on basename)
    const patternMatch = !rule.pattern || 
      this.minimatch(this.path.basename(imagePath), rule.pattern, { nocase: true });
    
    // Directory matching (check if path includes directory)
    const directoryMatch = !rule.directory || 
      this.matchesDirectory(imagePath, rule.directory);
    
    // Size matching
    const sizeMatch = this.checkSizeRule(rule, metadata);
    
    // All conditions must match
    return patternMatch && directoryMatch && sizeMatch;
  }

  /**
   * Check if image path matches directory rule
   */
  matchesDirectory(imagePath, ruleDirectory) {
    // Normalize paths for comparison
    const normalizedPath = imagePath.replace(/\\/g, '/');
    const normalizedDir = ruleDirectory.replace(/\\/g, '/');
    
    // Ensure directory ends with / for proper matching
    const dirWithSlash = normalizedDir.endsWith('/') ? normalizedDir : normalizedDir + '/';
    
    // Check if the image path includes the directory
    return normalizedPath.includes(dirWithSlash);
  }

  /**
   * Check if image metadata matches size rules
   */
  checkSizeRule(rule, metadata) {
    // If no size rules defined, it's a match
    if (!rule.minWidth && !rule.minHeight && 
        !rule.maxWidth && !rule.maxHeight) {
      return true;
    }
    
    // If size rules are defined but no metadata provided, it's not a match
    if (!metadata) {
      return false;
    }
    
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    if (rule.minWidth && width < rule.minWidth) {
      return false;
    }
    if (rule.minHeight && height < rule.minHeight) {
      return false;
    }
    if (rule.maxWidth && width > rule.maxWidth) {
      return false;
    }
    if (rule.maxHeight && height > rule.maxHeight) {
      return false;
    }
    
    return true;
  }

  /**
   * Sort rules by specificity (more specific rules first)
   */
  sortRulesBySpecificity(rules) {
    return [...rules].sort((a, b) => {
      const scoreA = this.getSpecificityScore(a);
      const scoreB = this.getSpecificityScore(b);
      return scoreB - scoreA; // Higher score = more specific = comes first
    });
  }

  /**
   * Calculate specificity score for a rule
   * Higher score means more specific
   */
  getSpecificityScore(rule) {
    let score = 0;
    
    // Pattern matching is most specific
    if (rule.pattern) {
      score += 4;
      // More specific patterns get higher scores
      // Count non-wildcard characters as specificity
      const nonWildcardChars = rule.pattern.replace(/[*?]/g, '').length;
      score += nonWildcardChars * 0.1;
    }
    
    // Directory matching is medium specific
    if (rule.directory) {
      score += 2;
      // Longer directory paths are more specific
      score += (rule.directory.split('/').filter(Boolean).length * 0.1);
    }
    
    // Size rules are least specific
    if (rule.minWidth || rule.minHeight || 
        rule.maxWidth || rule.maxHeight) {
      score += 1;
    }
    
    // Bonus points for combining multiple criteria
    const criteriaCount = [
      !!rule.pattern,
      !!rule.directory,
      !!(rule.minWidth || rule.minHeight || rule.maxWidth || rule.maxHeight)
    ].filter(Boolean).length;
    
    if (criteriaCount > 1) {
      score += criteriaCount * 2;
    }
    
    return score;
  }

  /**
   * Get a description of which rules matched (for debugging)
   */
  explainMatch(imagePath, metadata) {
    const matchingRules = this.rules.filter(rule => 
      this.ruleMatches(rule, imagePath, metadata)
    );
    
    return matchingRules.map(rule => {
      const parts = [];
      if (rule.pattern) {
        parts.push(`pattern: ${rule.pattern}`);
      }
      if (rule.directory) {
        parts.push(`directory: ${rule.directory}`);
      }
      if (rule.minWidth) {
        parts.push(`minWidth: ${rule.minWidth}`);
      }
      if (rule.minHeight) {
        parts.push(`minHeight: ${rule.minHeight}`);
      }
      if (rule.maxWidth) {
        parts.push(`maxWidth: ${rule.maxWidth}`);
      }
      if (rule.maxHeight) {
        parts.push(`maxHeight: ${rule.maxHeight}`);
      }
      
      return {
        criteria: parts.join(', '),
        quality: rule.quality,
        specificity: this.getSpecificityScore(rule)
      };
    });
  }
}

module.exports = QualityRulesEngine;