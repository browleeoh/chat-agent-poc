# FETCH ISSUES

Fetch the issues from the repo via the GitHub CLI. Tasks will be available as open issues. Fetch the body of the issues, as well as any comments.

# TASK BREAKDOWN

Break down the issues into tasks. Each issue may contain multiple tasks.

The tasks should biased small. We don't want to bite off more than we can chew.

# TASK SELECTION

Pick the next task. Prioritize from this list (where 1 is highest priority):

1. Architectural decisions and core abstractions
2. Integration points between modules
3. Unknown unknowns and spike work
4. Standard features
5. Polish and quick wins

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

# FEEDBACK LOOPS

Before committing, run the feedback loops:

- `npm run test` to run the tests
- `npm run typecheck` to run the type checker

# PROGRESS

After completing, append to progress.txt:

- Task completed and PRD reference
- Key decisions made
- Files changed
- Blockers or notes for next iteration
  Keep entries concise.
- Ensure you commit progress.txt with the changed code

# COMMIT

Make a git commit with a clear message.

# THE ISSUE

If the task is complete, close the original GitHub issue.

If the task is not complete, leave a comment on the GitHub issue with what was done.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
