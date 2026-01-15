/**
 * Represents clip sections with calculated word counts for UI display.
 * Used in the write page to show section checkboxes with word counts.
 */
export type SectionWithWordCount = {
  id: string;
  name: string;
  order: string;
  wordCount: number;
};

/**
 * Writing mode for the article writer.
 * Extends TextWritingAgentMode with additional YouTube/SEO variants.
 */
export type Mode =
  | "article"
  | "project"
  | "skill-building"
  | "style-guide-skill-building"
  | "style-guide-project"
  | "seo-description"
  | "youtube-title"
  | "youtube-thumbnail"
  | "youtube-description";

/**
 * AI model selection for article generation.
 */
export type Model = "claude-sonnet-4-5" | "claude-haiku-4-5";
