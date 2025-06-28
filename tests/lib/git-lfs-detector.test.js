const GitLfsDetector = require('../../src/git-lfs-detector');

describe('GitLfsDetector', () => {
  let detector;
  let mockFileReader;

  beforeEach(() => {
    mockFileReader = {
      readFile: jest.fn()
    };
    detector = new GitLfsDetector(mockFileReader);
  });

  describe('isGitLfsPointer', () => {
    it('should return true for valid git-lfs pointer files', async () => {
      const lfsContent = `version https://git-lfs.github.com/spec/v1
oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393
size 12345`;
      
      mockFileReader.readFile.mockResolvedValue(lfsContent);
      
      const result = await detector.isGitLfsPointer('/path/to/file.png');
      
      expect(result).toBe(true);
      expect(mockFileReader.readFile).toHaveBeenCalledWith('/path/to/file.png', 'utf8');
    });

    it('should return false for non-lfs files', async () => {
      mockFileReader.readFile.mockResolvedValue('PNG\r\n...');
      
      const result = await detector.isGitLfsPointer('/path/to/file.png');
      
      expect(result).toBe(false);
    });

    it('should return false when file cannot be read as text', async () => {
      mockFileReader.readFile.mockRejectedValue(new Error('Invalid UTF-8'));
      
      const result = await detector.isGitLfsPointer('/path/to/file.png');
      
      expect(result).toBe(false);
    });
  });
});