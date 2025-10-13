import {
  normalizeUrl,
  validateUrl,
  isValidUrl,
  extractHostname,
  extractDomain,
} from '../url-validation';

describe('URL Validation Utilities', () => {
  describe('normalizeUrl', () => {
    it('should auto-prepend https:// to domain-only URLs', () => {
      expect(normalizeUrl('microsoft.com')).toBe('https://microsoft.com');
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('www.github.com')).toBe('https://www.github.com');
    });

    it('should preserve existing protocols', () => {
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('ftp://files.com')).toBe('ftp://files.com');
    });

    it('should handle empty strings', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl('   ')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeUrl('  microsoft.com  ')).toBe('https://microsoft.com');
      expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
    });
  });

  describe('validateUrl', () => {
    it('should validate and normalize valid URLs', () => {
      const result1 = validateUrl('microsoft.com');
      expect(result1.valid).toBe(true);
      expect(result1.valid && result1.url).toBe('https://microsoft.com/');

      const result2 = validateUrl('https://example.com');
      expect(result2.valid).toBe(true);
      expect(result2.valid && result2.url).toBe('https://example.com/');
    });

    it('should reject invalid URLs', () => {
      const result1 = validateUrl('not a url');
      expect(result1.valid).toBe(false);
      expect(!result1.valid && result1.error).toContain('valid URL');

      const result2 = validateUrl('javascript:alert(1)');
      expect(result2.valid).toBe(false);
    });

    it('should handle complex URLs with paths and query params', () => {
      const result = validateUrl('github.com/user/repo?tab=readme');
      expect(result.valid).toBe(true);
      expect(result.valid && result.url).toContain('https://github.com');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('microsoft.com')).toBe(true);
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('javascript:void(0)')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('extractHostname', () => {
    it('should extract hostname from URLs', () => {
      expect(extractHostname('https://www.microsoft.com/en-us')).toBe('www.microsoft.com');
      expect(extractHostname('microsoft.com')).toBe('microsoft.com');
      expect(extractHostname('http://localhost:3000/path')).toBe('localhost');
    });

    it('should return null for invalid URLs', () => {
      expect(extractHostname('not a url')).toBe(null);
      expect(extractHostname('')).toBe(null);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain without subdomain', () => {
      expect(extractDomain('https://www.microsoft.com')).toBe('microsoft.com');
      expect(extractDomain('https://mail.google.com')).toBe('google.com');
      expect(extractDomain('https://github.com')).toBe('github.com');
    });

    it('should handle domain-only inputs', () => {
      expect(extractDomain('microsoft.com')).toBe('microsoft.com');
      expect(extractDomain('example.com')).toBe('example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractDomain('not a url')).toBe(null);
      expect(extractDomain('')).toBe(null);
    });
  });

  describe('Real-world edge cases', () => {
    it('should handle URLs with ports', () => {
      expect(isValidUrl('localhost:3000')).toBe(true);
      expect(isValidUrl('example.com:8080')).toBe(true);
    });

    it('should handle URLs with authentication', () => {
      const result = validateUrl('user:pass@example.com');
      expect(result.valid).toBe(true);
    });

    it('should handle international domain names', () => {
      expect(isValidUrl('münchen.de')).toBe(true);
      expect(isValidUrl('日本.jp')).toBe(true);
    });

    it('should handle localhost variations', () => {
      expect(isValidUrl('localhost')).toBe(true);
      expect(isValidUrl('127.0.0.1')).toBe(true);
      expect(isValidUrl('http://[::1]')).toBe(true);
    });

    it('should reject XSS attempts', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });
});
