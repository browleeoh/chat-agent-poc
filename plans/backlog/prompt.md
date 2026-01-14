# FETCH ISSUES

Fetch the issues from the repo via the GitHub CLI. Tasks will be available as open issues. Fetch the body of the issues, as well as any comments.

# TASK BREAKDOWN

Break down the issues into tasks. An issue may contain a single task (a small bugfix or visual tweak) or many, many tasks (a PRD or a large refactor).

Make each task the smallest possible unit of work. We don't want to outrun our headlights. Aim for one small change per task.

# TASK SELECTION

Pick the next task. Prioritize from this list (where 1 is highest priority):

1. Architectural decisions and core abstractions
2. Integration points between modules
3. Unknown unknowns and spike work
4. Standard features
5. Polish and quick wins

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

# EXECUTION

Complete the task.

If you find that the task is larger than you expected (for instance, requires a refactor first), output "HANG ON A SECOND".

Then, find a way to break it into a smaller chunk and only do that chunk (i.e. complete the smaller refactor).

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
