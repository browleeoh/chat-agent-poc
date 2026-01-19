import type { Mode } from "./types";

/**
 * Represents a single lint rule that can be applied to article writer output.
 */
export interface LintRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable name of the rule */
  name: string;
  /** Description of what the rule checks for */
  description: string;
  /** Modes this rule applies to (null = all modes) */
  modes: Mode[] | null;
  /** Regular expression pattern to detect violations */
  pattern: RegExp;
  /** Instruction to include in fix message */
  fixInstruction: string;
  /** If true, the pattern must be present (violation if missing). Default: false (violation if present) */
  required?: boolean;
}

/**
 * Represents a detected violation of a lint rule.
 */
export interface LintViolation {
  /** The rule that was violated */
  rule: LintRule;
  /** Number of times the violation appears */
  count: number;
}

/**
 * Phrases that are dead giveaways of LLM-generated content.
 * These should be avoided in all article writing.
 * Some patterns use regex syntax for context-aware matching.
 */
const DISALLOWED_PHRASES = [
  "uncomfortable truth",
  "hard truth",
  "spoiler[,:]",
  "here's the thing:",
  "yeah",
  "it's kind of like",
  "game[ -]?changer",
  "the reality[?!:;.,]",
  "the good news[?:]",
  "the irony[?]",
];

/**
 * Human-readable descriptions of disallowed phrases for fix instructions.
 */
const DISALLOWED_PHRASES_READABLE = [
  "uncomfortable truth",
  "hard truth",
  "spoiler (when followed by comma or colon)",
  "here's the thing:",
  "yeah",
  "it's kind of like",
  "game changer / game-changer",
  "the reality (when followed by punctuation)",
  "the good news (when followed by ? or :)",
  "the irony (when followed by ?)",
];

/**
 * The greeting sigil that must appear at the start of every newsletter.
 * Uses Liquid templating syntax for personalization.
 */
export const NEWSLETTER_GREETING_SIGIL = `Hey {{ subscriber.first_name | strip | default: "there" }},`;

/**
 * All lint rules for the article writer.
 * Add new rules here to automatically include them in lint checks.
 */
export const LINT_RULES: LintRule[] = [
  {
    id: "no-em-dash",
    name: "No Em Dashes",
    description: "Em dashes (—) should not be used in content",
    modes: null, // Applies to all modes
    pattern: /—/g,
    fixInstruction: "Replace all em dashes (—) with hyphens (-) or commas",
  },
  {
    id: "no-llm-phrases",
    name: "No LLM Phrases",
    description: "Phrases that are dead giveaways of LLM-generated content",
    modes: null, // Applies to all modes
    pattern: new RegExp(DISALLOWED_PHRASES.join("|"), "gi"),
    fixInstruction: `Remove or rephrase the following LLM-typical phrases: ${DISALLOWED_PHRASES_READABLE.join(", ")}`,
  },
  {
    id: "newsletter-greeting",
    name: "Newsletter Greeting",
    description: "Newsletter must start with the personalized greeting sigil",
    modes: ["newsletter"],
    pattern: new RegExp(
      "^" + NEWSLETTER_GREETING_SIGIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ),
    fixInstruction: `The newsletter must start with exactly: ${NEWSLETTER_GREETING_SIGIL}`,
    required: true,
  },
];
