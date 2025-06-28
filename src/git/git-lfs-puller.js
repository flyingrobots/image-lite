class GitLfsPuller {
  constructor(commandExecutor) {
    this.commandExecutor = commandExecutor;
  }

  async pullFile(filePath) {
    try {
      await this.commandExecutor.exec(`git lfs pull --include="${filePath}"`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = GitLfsPuller;