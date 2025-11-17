export const STEPS_TO_COMPLETE = `
<steps-to-complete>
Steps to complete should be in the format of checkboxes. Only the top level steps should be checkboxes. You can can use nested lists, but they should not be checkboxes.

Each top-level step should be separated by two newlines.

<example>

## Steps To Complete

- [ ] <A description of the step to take>
  - <some substep>

- [ ] <A description of the step to take>

- [ ] <A description of the step to take>
  - <some substep>
  - <some substep>

</example>

Include steps to test whether the problem has been solved, such as logging in the terminal (running the exercise via \`pnpm run dev\`), observing the local dev server at localhost:3000, or checking the browser console.
</steps-to-complete>
`.trim();
