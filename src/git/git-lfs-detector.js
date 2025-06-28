class GitLfsDetector {
  constructor(fileReader) {
    this.fileReader = fileReader;
  }

  async isGitLfsPointer(filePath) {
    try {
      const content = await this.fileReader.readFile(filePath, 'utf8');
      return content.startsWith('version https://git-lfs.github.com/spec/v1');
    } catch {
      // If we can't read as text, it's likely a binary file (actual image)
      return false;
    }
  }
}

module.exports = GitLfsDetector;