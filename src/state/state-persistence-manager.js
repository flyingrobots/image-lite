const fs = require('fs').promises;

class StatePersistenceManager {
  constructor(options = {}) {
    this.stateFile = options.stateFile || '.image-lite-state.json';
    this.logger = options.logger || console;
  }

  async save(state) {
    const stateData = {
      version: '1.0',
      startedAt: state.startedAt || new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      configuration: state.configuration || {},
      progress: state.progress || {},
      files: state.files || { processed: [], pending: [] }
    };

    try {
      await fs.writeFile(this.stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      this.logger.error('Failed to save state:', error.message);
      throw error;
    }
  }

  async load() {
    try {
      const stateData = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      // Validate state version
      if (state.version !== '1.0') {
        this.logger.warn('State file version mismatch, ignoring saved state');
        return null;
      }
      
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // No state file exists
      }
      this.logger.error('Failed to load state:', error.message);
      return null;
    }
  }

  async clear() {
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to clear state:', error.message);
        throw error;
      }
    }
  }

  async exists() {
    try {
      await fs.access(this.stateFile);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = StatePersistenceManager;