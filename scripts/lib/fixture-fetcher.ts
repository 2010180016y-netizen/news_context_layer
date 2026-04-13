import type { TextFetcher } from '../../apps/jobs/src/ingest/fetch-rss.js';

function sectionFromUrl(url: URL): string {
  const fileName = url.pathname.split('/').at(-1) ?? 'general.xml';
  return fileName.replace(/\.xml$/i, '');
}

function isoForSection(section: string, offsetMinutes: number): string {
  const base = new Date(`2026-04-10T00:00:00.000Z`);
  const sectionOffset = section === 'politics' ? 0 : 180;
  return new Date(base.getTime() + (sectionOffset + offsetMinutes) * 60_000).toUTCString();
}

function buildArticleUrl(host: string, section: string, slug: string): string {
  return `https://${host}/articles/${section}/${slug}`;
}

function buildRssXml(url: URL): string {
  const section = sectionFromUrl(url);
  const host = url.hostname;
  const sharedUrl = buildArticleUrl(host, section, `${section}-shared-story`);
  const exclusiveUrl = buildArticleUrl(host, section, `${section}-rss-exclusive`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${host} ${section} RSS</title>
    <item>
      <guid>${sharedUrl}</guid>
      <title>${section} shared story</title>
      <link>${sharedUrl}</link>
      <description>${section} shared story summary from rss</description>
      <author>desk@${host}</author>
      <category>${section}</category>
      <pubDate>${isoForSection(section, 15)}</pubDate>
    </item>
    <item>
      <guid>${exclusiveUrl}</guid>
      <title>${section} rss exclusive</title>
      <link>${exclusiveUrl}</link>
      <description>${section} exclusive update discovered from rss</description>
      <dc:creator>${host} reporter</dc:creator>
      <category>${section}</category>
      <category>news</category>
      <pubDate>${isoForSection(section, 30)}</pubDate>
    </item>
  </channel>
</rss>`;
}

function buildSitemapXml(url: URL): string {
  const section = sectionFromUrl(url);
  const host = url.hostname;
  const sharedUrl = buildArticleUrl(host, section, `${section}-shared-story`);
  const uniqueUrl = buildArticleUrl(host, section, `${section}-sitemap-update`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${sharedUrl}</loc>
    <lastmod>${new Date(`2026-04-10T01:00:00.000Z`).toISOString()}</lastmod>
  </url>
  <url>
    <loc>${uniqueUrl}</loc>
    <lastmod>${new Date(`2026-04-10T02:00:00.000Z`).toISOString()}</lastmod>
  </url>
</urlset>`;
}

export class FixtureTextFetcher implements TextFetcher {
  public fetchText(rawUrl: string): Promise<string> {
    const url = new URL(rawUrl);

    if (url.pathname.includes('/rss/')) {
      return Promise.resolve(buildRssXml(url));
    }

    if (url.pathname.includes('/sitemap/')) {
      return Promise.resolve(buildSitemapXml(url));
    }

    throw new Error(`No local fixture payload mapped for ${rawUrl}.`);
  }
}
