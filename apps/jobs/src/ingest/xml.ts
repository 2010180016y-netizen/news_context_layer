function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanXmlText(value: string): string {
  return decodeHtmlEntities(value.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim());
}

export function collectBlocks(xml: string, tagName: string): string[] {
  const matcher = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const blocks: string[] = [];
  let match = matcher.exec(xml);

  while (match !== null) {
    const captured = match[1];

    if (captured !== undefined) {
      blocks.push(captured);
    }

    match = matcher.exec(xml);
  }

  return blocks;
}

export function collectTagValues(xml: string, tagName: string): string[] {
  return collectBlocks(xml, tagName).map((value) => cleanXmlText(value));
}

export function getFirstTagValue(xml: string, tagName: string): string | null {
  const values = collectTagValues(xml, tagName);
  return values[0] ?? null;
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
