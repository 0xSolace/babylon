import { describe, expect, test } from 'bun:test';
import { detectDevice } from './react-device-detect-shim';

describe('detectDevice', () => {
  test('detects Firefox user agents without touching vendor globals', () => {
    expect(
      detectDevice({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15',
      })
    ).toMatchObject({
      isFirefox: true,
      isIOS: true,
      isMobile: true,
      isSafari: false,
    });
  });

  test('treats iPadOS desktop user agents as iOS mobile devices', () => {
    expect(
      detectDevice({
        maxTouchPoints: 5,
        platform: 'MacIntel',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      })
    ).toMatchObject({
      isIOS: true,
      isMobile: true,
      isSafari: true,
    });
  });

  test('detects Android Chrome as mobile but not Safari or Firefox', () => {
    expect(
      detectDevice({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
      })
    ).toMatchObject({
      isAndroid: true,
      isFirefox: false,
      isIOS: false,
      isMobile: true,
      isSafari: false,
    });
  });
});
