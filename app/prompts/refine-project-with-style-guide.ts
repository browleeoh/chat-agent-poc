import { getImageInstructions } from "./image-instructions";
import { PROJECT_STYLE_GUIDE } from "./project-style-guide";
import fs from "fs";
import path from "path";

const PROJECT_STEPS_SAMPLE = fs.readFileSync(
  path.join(import.meta.dirname, "project-steps-sample.md"),
  "utf-8"
);

export const refineProjectWithStyleGuidePrompt = (opts: {
  code: {
    path: string;
    content: string;
  }[];
  transcript: string;
  images: string[];
}) => {
  // Find the README.md file in the code context
  const readmeFile = opts.code.find((file) =>
    file.path.toLowerCase().endsWith("readme.md")
  );

  if (!readmeFile) {
    throw new Error(
      "No README.md file found in code context. Please include the README.md file you want to refine."
    );
  }

  const transcriptSection = opts.transcript
    ? `Here is the transcript of the video (for additional context):

<transcript>
${opts.transcript}
</transcript>

`
    : "";

  return `
<role-context>
You are a helpful assistant being asked to refine an existing project lesson README to match our style guide and formatting standards.

The user has provided an existing README that needs to be polished to ensure consistency with our style guide.
</role-context>

## Documents

Here is the existing README content that needs to be refined:

<existing-readme>
${readmeFile.content}
</existing-readme>

${transcriptSection}Here is the code for the video (for reference):

<code>
${opts.code
  .filter((file) => !file.path.toLowerCase().endsWith("readme.md"))
  .map((file) => `<file path="${file.path}">${file.content}</file>`)
  .join("\n")}
</code>

Here is a sample of what a well-formatted project README looks like:

<example-format>
${PROJECT_STEPS_SAMPLE}
</example-format>

${PROJECT_STYLE_GUIDE}

${getImageInstructions(opts.images)}

<the-ask>
Refine the existing README to match our style guide and formatting standards. Apply all the rules above, ensuring:

1. Paragraphs are short (max 240 characters)
2. Code elements use backticks
3. H2 titles use continuous verb form (present participle): "Adding" not "Added"
4. Markdown comment <!-- VIDEO --> appears after H2
5. Code samples are used effectively
6. Steps to complete follow the checkbox format
7. Grammar is correct (e.g., "going to" instead of "gonna")
8. Imports and commands shown directly (not in spoilers)
9. Solution code wrapped in <Spoiler> tags
10. Code annotations (ADDED, CHANGED, DELETED) on specific lines
11. Each code sample has file path comment at top

Output the COMPLETE refined README - do not output just the changes.
</the-ask>

<output-format>
Do not enter into conversation with the user. Always assume that their messages to you are instructions for editing the content.

Respond only with the refined README content. Do not include any other text or explanations.
</output-format>
`.trim();
};
