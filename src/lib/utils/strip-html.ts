/**
 * Strips HTML tags from Shopify product descriptions before display. Product descriptions are
 * merchant-authored content synchronized from Shopify — untrusted input from this app's
 * perspective — so this avoids rendering it as HTML (and the stored-XSS risk that implies)
 * without pulling in a full sanitizer for what's otherwise a plain-text display.
 */
export function stripHtml(html: string): string {
  return html
    // Remove script/style elements including their content — a tag-only strip would leave the
    // script's own code visible as plain text, which is exactly what happened before this fix.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
