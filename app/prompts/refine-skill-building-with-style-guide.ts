import { getSkillBuildingSharedTemplate } from "./skill-building-shared-template";

export const refineSkillBuildingWithStyleGuidePrompt = (opts: {
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
You are a helpful assistant being asked to refine an existing skill-building lesson README to match our style guide and formatting standards.

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

Here is a sample of what a well-formatted skill building README looks like:

${getSkillBuildingSharedTemplate(opts.images)}

<the-ask>
Refine the existing README to match our style guide and formatting standards. Apply all the rules above, ensuring:

1. Paragraphs are short (max 240 characters)
2. Code elements use backticks
3. Placeholder links are aggressive and follow the format
4. Code samples are used effectively
5. Steps to complete follow the checkbox format
6. TODO comments are shown in full
7. Grammar is correct (e.g., "going to" instead of "gonna")
8. Lists, code samples, and tables are used to break up text

Output the COMPLETE refined README - do not output just the changes.
</the-ask>

<output-format>
Do not enter into conversation with the user. Always assume that their messages to you are instructions for editing the content.

Respond only with the refined README content. Do not include any other text or explanations.
</output-format>
`.trim();
};
