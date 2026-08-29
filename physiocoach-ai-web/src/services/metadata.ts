import { useEffect } from 'react';

export interface PageMetadataOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'profile';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  noindex?: boolean;
}

export const DEFAULT_PAGE_TITLE = 'PhysioCoach AI · Precision Athletic & Rehab Platform';
export const DEFAULT_PAGE_DESCRIPTION =
  'Medical-grade AI strength programming, injury-aware biomechanical safeguards, and live gym floor tracking.';
export const DEFAULT_OG_IMAGE = 'https://physiocoach.ai/og-preview.png';
export const SITE_NAME = 'PhysioCoach AI';
export const BASE_SITE_URL = 'https://physiocoach.ai';

function formatDocumentTitle(title?: string): string {
  if (!title || !title.trim()) {
    return DEFAULT_PAGE_TITLE;
  }
  const clean = title.trim();
  if (clean.toLowerCase().includes('physiocoach')) {
    return clean;
  }
  return `${clean} · ${SITE_NAME}`;
}

function setMetaElement(identifier: string, content: string | undefined, isProperty = false): void {
  if (typeof document === 'undefined') return;

  const selector = isProperty ? `meta[property="${identifier}"]` : `meta[name="${identifier}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (content !== undefined && content !== null) {
    if (!element) {
      element = document.createElement('meta');
      if (isProperty) {
        element.setAttribute('property', identifier);
      } else {
        element.setAttribute('name', identifier);
      }
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  } else if (element) {
    element.remove();
  }
}

function setCanonicalUrl(url?: string): void {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

  if (url) {
    if (!element) {
      element = document.createElement('link');
      element.setAttribute('rel', 'canonical');
      document.head.appendChild(element);
    }
    element.setAttribute('href', url);
  } else if (element) {
    element.remove();
  }
}

export function updatePageMetadata(options: PageMetadataOptions = {}): void {
  if (typeof document === 'undefined') return;

  const fullTitle = formatDocumentTitle(options.title);
  const description = options.description?.trim() || DEFAULT_PAGE_DESCRIPTION;
  const image = options.ogImage || DEFAULT_OG_IMAGE;
  const ogType = options.ogType || 'website';
  const twitterCard = options.twitterCard || 'summary_large_image';
  const canonical =
    options.canonicalUrl || (typeof window !== 'undefined' ? window.location.href : BASE_SITE_URL);
  const robots = options.noindex ? 'noindex, nofollow' : 'index, follow';

  // 1. Document title
  document.title = fullTitle;

  // 2. Standard HTML meta
  setMetaElement('description', description, false);
  setMetaElement('robots', robots, false);
  if (options.keywords && options.keywords.length > 0) {
    setMetaElement('keywords', options.keywords.join(', '), false);
  }

  // 3. OpenGraph meta tags
  setMetaElement('og:title', fullTitle, true);
  setMetaElement('og:description', description, true);
  setMetaElement('og:type', ogType, true);
  setMetaElement('og:url', canonical, true);
  setMetaElement('og:image', image, true);
  setMetaElement('og:site_name', SITE_NAME, true);

  if (options.ogImageAlt) {
    setMetaElement('og:image:alt', options.ogImageAlt, true);
  }

  // 4. Twitter Card meta tags
  setMetaElement('twitter:card', twitterCard, false);
  setMetaElement('twitter:title', fullTitle, false);
  setMetaElement('twitter:description', description, false);
  setMetaElement('twitter:image', image, false);

  // 5. Canonical Link
  setCanonicalUrl(canonical);
}

export function usePageMetadata(
  options: PageMetadataOptions,
  deps: React.DependencyList = [],
): void {
  useEffect(() => {
    updatePageMetadata(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
