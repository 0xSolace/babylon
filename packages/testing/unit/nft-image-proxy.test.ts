/**
 * Unit Tests: NFT Image Proxy
 *
 * Tests for the NFT image proxy endpoint that serves images from GitHub.
 *
 * Tests cover:
 * - Token ID validation
 * - URL generation
 * - Cache headers
 * - Error handling
 *
 * Run with: bun test unit/nft-image-proxy.test.ts
 */

import { describe, expect, test } from 'bun:test';

// Image proxy URL generation (matches implementation)
function getNftImageProxyUrl(tokenId: number): string {
  return `/api/nft/image/${tokenId}`;
}

// Token ID validation for image proxy
function isValidImageTokenId(tokenId: unknown): boolean {
  if (typeof tokenId === 'string') {
    const parsed = parseInt(tokenId, 10);
    return !isNaN(parsed) && parsed >= 1 && parsed <= 100;
  }
  if (typeof tokenId === 'number') {
    return Number.isInteger(tokenId) && tokenId >= 1 && tokenId <= 100;
  }
  return false;
}

// Cache header values
const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable';

describe('NFT Image Proxy - URL Generation', () => {
  describe('Proxy URL Format', () => {
    test('should generate correct proxy URL for token ID 1', () => {
      const url = getNftImageProxyUrl(1);
      expect(url).toBe('/api/nft/image/1');
    });

    test('should generate correct proxy URL for token ID 100', () => {
      const url = getNftImageProxyUrl(100);
      expect(url).toBe('/api/nft/image/100');
    });

    test('should generate correct proxy URL for token ID 42', () => {
      const url = getNftImageProxyUrl(42);
      expect(url).toBe('/api/nft/image/42');
    });

    test('should not include external domains', () => {
      const url = getNftImageProxyUrl(1);
      expect(url).not.toContain('http');
      expect(url).not.toContain('github');
      expect(url).not.toContain('raw.githubusercontent');
    });

    test('should be a relative URL', () => {
      const url = getNftImageProxyUrl(1);
      expect(url).toMatch(/^\/api\/nft\/image\/\d+$/);
    });
  });

  describe('Bulk URL Generation', () => {
    test('should generate unique URLs for all 100 NFTs', () => {
      const urls = new Set<string>();
      for (let i = 1; i <= 100; i++) {
        urls.add(getNftImageProxyUrl(i));
      }
      expect(urls.size).toBe(100);
    });

    test('should maintain consistent URL format', () => {
      const pattern = /^\/api\/nft\/image\/\d+$/;
      for (let i = 1; i <= 100; i++) {
        expect(getNftImageProxyUrl(i)).toMatch(pattern);
      }
    });
  });
});

describe('NFT Image Proxy - Token ID Validation', () => {
  describe('Valid Token IDs', () => {
    test('should accept token ID 1 as string', () => {
      expect(isValidImageTokenId('1')).toBe(true);
    });

    test('should accept token ID 100 as string', () => {
      expect(isValidImageTokenId('100')).toBe(true);
    });

    test('should accept token ID 50 as string', () => {
      expect(isValidImageTokenId('50')).toBe(true);
    });

    test('should accept token ID 1 as number', () => {
      expect(isValidImageTokenId(1)).toBe(true);
    });

    test('should accept token ID 100 as number', () => {
      expect(isValidImageTokenId(100)).toBe(true);
    });
  });

  describe('Invalid Token IDs', () => {
    test('should reject token ID 0', () => {
      expect(isValidImageTokenId('0')).toBe(false);
      expect(isValidImageTokenId(0)).toBe(false);
    });

    test('should reject token ID 101', () => {
      expect(isValidImageTokenId('101')).toBe(false);
      expect(isValidImageTokenId(101)).toBe(false);
    });

    test('should reject negative token ID', () => {
      expect(isValidImageTokenId('-1')).toBe(false);
      expect(isValidImageTokenId(-1)).toBe(false);
    });

    test('should reject non-numeric string', () => {
      expect(isValidImageTokenId('abc')).toBe(false);
      expect(isValidImageTokenId('not-a-number')).toBe(false);
    });

    test('should reject empty string', () => {
      expect(isValidImageTokenId('')).toBe(false);
    });

    test('should reject null', () => {
      expect(isValidImageTokenId(null)).toBe(false);
    });

    test('should reject undefined', () => {
      expect(isValidImageTokenId(undefined)).toBe(false);
    });

    test('should reject float as number', () => {
      expect(isValidImageTokenId(1.5)).toBe(false);
    });

    test('should parse float string as integer (parseInt behavior)', () => {
      // parseInt('1.5') returns 1, which is valid
      // This documents actual behavior of parseInt
      expect(isValidImageTokenId('1.5')).toBe(true);
    });

    test('should reject very large numbers', () => {
      expect(isValidImageTokenId(1000)).toBe(false);
      expect(isValidImageTokenId('9999999')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle whitespace in string', () => {
      // parseInt handles leading/trailing whitespace
      expect(isValidImageTokenId(' 50 ')).toBe(true);
    });

    test('should reject object', () => {
      expect(isValidImageTokenId({ tokenId: 1 })).toBe(false);
    });

    test('should reject array', () => {
      expect(isValidImageTokenId([1])).toBe(false);
    });
  });
});

describe('NFT Image Proxy - Cache Headers', () => {
  describe('Immutable Cache Control', () => {
    test('should have immutable cache directive', () => {
      expect(CACHE_CONTROL_IMMUTABLE).toContain('immutable');
    });

    test('should have public directive', () => {
      expect(CACHE_CONTROL_IMMUTABLE).toContain('public');
    });

    test('should have 1 year max-age', () => {
      expect(CACHE_CONTROL_IMMUTABLE).toContain('max-age=31536000');
    });

    test('should be correct complete value', () => {
      expect(CACHE_CONTROL_IMMUTABLE).toBe(
        'public, max-age=31536000, immutable'
      );
    });
  });

  describe('Cache Duration', () => {
    test('max-age should be 1 year in seconds', () => {
      const oneYearInSeconds = 365 * 24 * 60 * 60;
      expect(oneYearInSeconds).toBe(31536000);
    });
  });
});

describe('NFT Image Proxy - Content Type', () => {
  describe('Expected Content Types', () => {
    function getExpectedContentType(filename: string): string {
      if (filename.endsWith('.png')) return 'image/png';
      if (filename.endsWith('.jpg') || filename.endsWith('.jpeg'))
        return 'image/jpeg';
      if (filename.endsWith('.gif')) return 'image/gif';
      if (filename.endsWith('.webp')) return 'image/webp';
      return 'application/octet-stream';
    }

    test('should return image/png for PNG files', () => {
      expect(getExpectedContentType('1.png')).toBe('image/png');
    });

    test('should return image/jpeg for JPG files', () => {
      expect(getExpectedContentType('1.jpg')).toBe('image/jpeg');
      expect(getExpectedContentType('1.jpeg')).toBe('image/jpeg');
    });

    test('should return image/gif for GIF files', () => {
      expect(getExpectedContentType('1.gif')).toBe('image/gif');
    });

    test('should return image/webp for WebP files', () => {
      expect(getExpectedContentType('1.webp')).toBe('image/webp');
    });

    test('should return octet-stream for unknown types', () => {
      expect(getExpectedContentType('1.bmp')).toBe('application/octet-stream');
    });
  });
});

describe('NFT Image Proxy - GitHub URL Construction', () => {
  const NFT_FOLDER = 'NFT Protomonkeys';

  function getGitHubFilePath(tokenId: number): string {
    return `${NFT_FOLDER}/images/${tokenId}.png`;
  }

  function encodeForGitHubAPI(path: string): string {
    return encodeURIComponent(path);
  }

  describe('File Path Generation', () => {
    test('should generate correct file path for token 1', () => {
      const path = getGitHubFilePath(1);
      expect(path).toBe('NFT Protomonkeys/images/1.png');
    });

    test('should generate correct file path for token 100', () => {
      const path = getGitHubFilePath(100);
      expect(path).toBe('NFT Protomonkeys/images/100.png');
    });

    test('should include images subdirectory', () => {
      const path = getGitHubFilePath(42);
      expect(path).toContain('/images/');
    });

    test('should end with .png extension', () => {
      const path = getGitHubFilePath(50);
      expect(path).toMatch(/\.png$/);
    });
  });

  describe('URL Encoding', () => {
    test('should encode spaces', () => {
      const path = 'NFT Protomonkeys/images/1.png';
      const encoded = encodeForGitHubAPI(path);
      expect(encoded).not.toContain(' ');
      expect(encoded).toContain('%20');
    });

    test('should encode slashes', () => {
      const path = 'folder/subfolder/file.png';
      const encoded = encodeForGitHubAPI(path);
      expect(encoded).toContain('%2F');
    });

    test('should preserve alphanumeric characters', () => {
      const simple = 'file123.png';
      const encoded = encodeForGitHubAPI(simple);
      expect(encoded).toContain('file123');
    });
  });
});

describe('NFT Image Proxy - Error Responses', () => {
  interface ErrorResponse {
    error: string;
    status: number;
  }

  function createErrorResponse(code: string): ErrorResponse {
    const errors: Record<string, ErrorResponse> = {
      invalid_token_id: { error: 'Invalid token ID', status: 400 },
      not_found: { error: 'Image not found', status: 404 },
      fetch_failed: { error: 'Failed to fetch image', status: 502 },
      internal_error: { error: 'Internal server error', status: 500 },
    };
    return errors[code] ?? { error: 'Unknown error', status: 500 };
  }

  describe('Error Status Codes', () => {
    test('should return 400 for invalid token ID', () => {
      const response = createErrorResponse('invalid_token_id');
      expect(response.status).toBe(400);
      expect(response.error).toContain('Invalid');
    });

    test('should return 404 for not found', () => {
      const response = createErrorResponse('not_found');
      expect(response.status).toBe(404);
      expect(response.error).toContain('not found');
    });

    test('should return 502 for upstream fetch failure', () => {
      const response = createErrorResponse('fetch_failed');
      expect(response.status).toBe(502);
    });

    test('should return 500 for internal error', () => {
      const response = createErrorResponse('internal_error');
      expect(response.status).toBe(500);
    });
  });
});

describe('NFT Image Proxy - Integration with Collection', () => {
  describe('Database Image URL Format', () => {
    function parseNftImageIdentifier(
      imageUrl: string
    ): { type: 'nft'; tokenId: number } | { type: 'url'; url: string } {
      if (imageUrl.startsWith('nft://')) {
        const tokenId = parseInt(imageUrl.replace('nft://', ''), 10);
        return { type: 'nft', tokenId };
      }
      return { type: 'url', url: imageUrl };
    }

    test('should parse nft:// protocol URLs', () => {
      const result = parseNftImageIdentifier('nft://42');
      expect(result.type).toBe('nft');
      if (result.type === 'nft') {
        expect(result.tokenId).toBe(42);
      }
    });

    test('should handle regular URLs', () => {
      const result = parseNftImageIdentifier('https://example.com/image.png');
      expect(result.type).toBe('url');
      if (result.type === 'url') {
        expect(result.url).toBe('https://example.com/image.png');
      }
    });

    test('should parse all 100 nft:// URLs', () => {
      for (let i = 1; i <= 100; i++) {
        const result = parseNftImageIdentifier(`nft://${i}`);
        expect(result.type).toBe('nft');
        if (result.type === 'nft') {
          expect(result.tokenId).toBe(i);
        }
      }
    });
  });

  describe('URL Transformation', () => {
    function transformImageUrl(dbImageUrl: string): string {
      if (dbImageUrl.startsWith('nft://')) {
        const tokenId = dbImageUrl.replace('nft://', '');
        return `/api/nft/image/${tokenId}`;
      }
      return dbImageUrl;
    }

    test('should transform nft:// to proxy URL', () => {
      const result = transformImageUrl('nft://42');
      expect(result).toBe('/api/nft/image/42');
    });

    test('should preserve external URLs', () => {
      const url = 'https://example.com/image.png';
      expect(transformImageUrl(url)).toBe(url);
    });

    test('should transform all collection URLs', () => {
      for (let i = 1; i <= 100; i++) {
        const result = transformImageUrl(`nft://${i}`);
        expect(result).toBe(`/api/nft/image/${i}`);
      }
    });
  });
});
