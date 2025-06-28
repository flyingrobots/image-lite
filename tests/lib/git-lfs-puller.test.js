const GitLfsPuller = require('../../src/git/git-lfs-puller');

describe('GitLfsPuller', () => {
  let puller;
  let mockCommandExecutor;

  beforeEach(() => {
    mockCommandExecutor = {
      exec: jest.fn()
    };
    puller = new GitLfsPuller(mockCommandExecutor);
  });

  describe('pullFile', () => {
    it('should return success when pull succeeds', async () => {
      mockCommandExecutor.exec.mockResolvedValue();
      
      const result = await puller.pullFile('/path/to/file.png');
      
      expect(result).toEqual({ success: true });
      expect(mockCommandExecutor.exec).toHaveBeenCalledWith(
        'git lfs pull --include="/path/to/file.png"'
      );
    });

    it('should return error details when pull fails', async () => {
      const error = new Error('LFS object not found');
      mockCommandExecutor.exec.mockRejectedValue(error);
      
      const result = await puller.pullFile('/path/to/file.png');
      
      expect(result).toEqual({ 
        success: false, 
        error: 'LFS object not found' 
      });
    });
  });
});