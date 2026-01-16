import { useMemo } from "react";
import {
  LINT_RULES,
  type LintViolation,
} from "@/features/article-writer/lint-rules";
import type { Mode } from "@/features/article-writer/types";

/**
 * Hook to check text for lint rule violations and compose fix messages.
 *
 * @param text - The text to check for violations
 * @param mode - The current writing mode (determines which rules apply)
 * @returns Object containing violations array and fix message composer
 *
 * @example
 * ```tsx
 * const { violations, composeFix Message } = useLint(lastAssistantMessage, mode);
 *
 * if (violations.length > 0) {
 *   const fixMessage = composeFixMessage();
 *   // Send fixMessage to LLM
 * }
 * ```
 */
export function useLint(text: string | null, mode: Mode) {
  const violations = useMemo(() => {
    if (!text) return [];

    const results: LintViolation[] = [];

    for (const rule of LINT_RULES) {
      // Skip rules that don't apply to this mode
      if (rule.modes !== null && !rule.modes.includes(mode)) {
        continue;
      }

      // Check for matches
      const matches = text.match(rule.pattern);
      if (matches && matches.length > 0) {
        results.push({
          rule,
          count: matches.length,
        });
      }
    }

    return results;
  }, [text, mode]);

  const composeFixMessage = useMemo(() => {
    return () => {
      if (violations.length === 0) return "";

      const instructions = violations
        .map((v) => `- ${v.rule.fixInstruction}`)
        .join("\n");

      return `Please fix the following issues in your response:\n${instructions}\n\nOutput the corrected version.`;
    };
  }, [violations]);

  return {
    violations,
    composeFixMessage,
  };
}
