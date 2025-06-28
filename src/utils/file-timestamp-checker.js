class FileTimestampChecker {
  constructor(fileStats) {
    this.fileStats = fileStats;
  }

  async shouldProcess(inputPath, outputPaths, forceReprocess) {
    if (forceReprocess) {
      return true;
    }
    
    const inputModTime = await this.getModTime(inputPath);
    if (!inputModTime) {
      return false;
    }

    for (const outputPath of outputPaths) {
      const outputModTime = await this.getModTime(outputPath);
      if (!outputModTime || inputModTime > outputModTime) {
        return true;
      }
    }
    
    return false;
  }

  async getModTime(filePath) {
    try {
      const stats = await this.fileStats.stat(filePath);
      return stats.mtime;
    } catch {
      return null;
    }
  }
}

module.exports = FileTimestampChecker;