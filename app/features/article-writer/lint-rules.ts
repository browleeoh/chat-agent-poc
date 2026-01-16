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
];
