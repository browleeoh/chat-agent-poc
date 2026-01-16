/**
 * Base style guide without placeholder link instructions.
 * Use this for modes that shouldn't include placeholder links (article, newsletter, SEO, YouTube).
 */
export const STYLE_GUIDE_BASE = `
<style-guide>
### Formatting

Place section headings into the transcript.

Use backticks to format code elements mentioned in the transcript. When referring to ids, prefer \`chatId\` over chat ID. \`messageId\` over message ID. \`userId\` over user ID.

Use quite short paragraphs - no more than 240 characters. Vary the length of the paragraphs to keep the article interesting.

One way to make a poor output is to only use paragraphs. Instead, we should break up the paragraphs with lists, code samples and markdown tables.

Use markdown tables to show data, or comparisons between different concepts and ideas.

Use lists to show steps taken, to show a list of things, or to illustrate how current/desired behavior works.

Replace instances of "gonna" with "going to".
</style-guide>
`.trim();

/**
 * Placeholder link instructions for modes that should include them
 * (steps project, steps skill building, style guide pass).
 */
export const PLACEHOLDER_LINK_INSTRUCTIONS = `
<links>
Link to external resources extremely aggressively. We want our users to EASILY be able to find the resources they need to complete the lesson.

ALL external resource should be written as a placeholder link. For example:
<placeholder-link-examples>
<example>
I recommend using [this tool](/PLACEHOLDER/the-name-of-the-tool) to solve the problem.
</example>
<example>
Here is the documentation for the [AI SDK feature you're using](/PLACEHOLDER/the-name-of-the-feature).
</example>
</placeholder-link-examples>
</links>

The output should be PEPPERED with placeholder links.

Types of things you should add links for:
- Names of functions from libraries, like \`generateObject()\`, \`onFinish()\`, \`loadMemories()\`, \`saveMemories()\`, etc.
- Types from libraries, like \`UIMessage\`, \`MessagePart\`, \`ToolSet\`, \`Tool\`, \`ToolResult\`, etc.
- Names of libraries, like AI SDK, Effect, Evalite, etc.
- Properties of objects that come from libraries, like \`response.messages\`, \`result.toolCalls\`, etc.
- Concepts from libraries, like "streaming", "tool calling", "message history", "message parts", "consuming streams".
- Any direct references in the transcript to external resources, such as "reference material", "documentation", "examples"
`.trim();

/**
 * Full style guide including placeholder link instructions.
 * Use this for modes that should include placeholder links (steps project, steps skill building, style guide pass).
 */
export const STYLE_GUIDE = `
${STYLE_GUIDE_BASE}

${PLACEHOLDER_LINK_INSTRUCTIONS}
`.trim();

export const CODE_SAMPLES = `
<code-samples>
Use code samples to describe what the text is saying. Use it to describe what outputs might look like in the terminal or browser. Use it to illustrate the code that's being discussed.

The teacher might refer to code by saying 'here', or 'in this bit'. In these cases, use code samples so that the reader can see the code the text refers to.

When you explain what's happening inside the code samples, make the explanation physically close to the code sample on the page. I prefer having the explanation for the code _above_ the code, not below it.

When the teacher refers to a terminal output, show the output of the terminal command in a 'txt' code block.

### Show Code Samples In Context

When showing code samples, try to show code in the context where it's being used. For instance - if you're discussing passing properties to a function, show the function call with the properties passed in.
`.trim();

export const TODO_COMMENTS = `
<todo-comments>
There will likely be TODO comments in the code samples. These are important instructions for the user.

When showing code samples, include the TODO comments related to them in full. They will help the user situate themselves in the code and understand what's needed.
</todo-comments>
`;
