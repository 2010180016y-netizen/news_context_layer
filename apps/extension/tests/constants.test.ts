import { describe, expect, it } from 'vitest';

import { DEFAULT_SIDEPANEL_PATH, SUPPORTED_HOSTNAME, extensionDescriptor, isSupportedNaverNewsUrl } from '../src/lib/constants.js';

describe('extension constants', () => {
  it('exposes the skeleton descriptor', () => {
    expect(extensionDescriptor).toEqual({
      id: 'extension',
      displayName: 'News Context Extension',
      stage: 'skeleton',
    });
  });

  it('accepts only supported naver news article urls', () => {
    expect(DEFAULT_SIDEPANEL_PATH).toBe('sidepanel/index.html');
    expect(SUPPORTED_HOSTNAME).toBe('n.news.naver.com');
    expect(isSupportedNaverNewsUrl('https://n.news.naver.com/article/001/0012345678')).toBe(true);
    expect(isSupportedNaverNewsUrl('https://example.com/article/123')).toBe(false);
    expect(isSupportedNaverNewsUrl('not-a-url')).toBe(false);
  });
});
