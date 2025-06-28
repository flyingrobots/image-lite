const FileTimestampChecker = require('../../src/utils/file-timestamp-checker');

describe('FileTimestampChecker', () => {
  let checker;
  let mockFileStats;

  beforeEach(() => {
    mockFileStats = {
      stat: jest.fn()
    };
    checker = new FileTimestampChecker(mockFileStats);
  });

  describe('shouldProcess', () => {
    it('should always return true when forceReprocess is enabled', async () => {
      const result = await checker.shouldProcess(
        '/input.png',
        ['/output1.png', '/output2.png'],
        true
      );
      
      expect(result).toBe(true);
      expect(mockFileStats.stat).not.toHaveBeenCalled();
    });

    it('should return false when input file does not exist', async () => {
      mockFileStats.stat.mockRejectedValue(new Error('File not found'));
      
      const result = await checker.shouldProcess(
        '/input.png',
        ['/output.png'],
        false
      );
      
      expect(result).toBe(false);
    });

    it('should return true when output file does not exist', async () => {
      const inputTime = new Date('2024-01-01');
      mockFileStats.stat
        .mockResolvedValueOnce({ mtime: inputTime })
        .mockRejectedValueOnce(new Error('File not found'));
      
      const result = await checker.shouldProcess(
        '/input.png',
        ['/output.png'],
        false
      );
      
      expect(result).toBe(true);
    });

    it('should return true when input is newer than output', async () => {
      const inputTime = new Date('2024-01-02');
      const outputTime = new Date('2024-01-01');
      
      mockFileStats.stat
        .mockResolvedValueOnce({ mtime: inputTime })
        .mockResolvedValueOnce({ mtime: outputTime });
      
      const result = await checker.shouldProcess(
        '/input.png',
        ['/output.png'],
        false
      );
      
      expect(result).toBe(true);
    });

    it('should return false when all outputs are up to date', async () => {
      const inputTime = new Date('2024-01-01');
      const outputTime = new Date('2024-01-02');
      
      mockFileStats.stat
        .mockResolvedValueOnce({ mtime: inputTime })
        .mockResolvedValueOnce({ mtime: outputTime })
        .mockResolvedValueOnce({ mtime: outputTime });
      
      const result = await checker.shouldProcess(
        '/input.png',
        ['/output1.png', '/output2.png'],
        false
      );
      
      expect(result).toBe(false);
    });
  });
});