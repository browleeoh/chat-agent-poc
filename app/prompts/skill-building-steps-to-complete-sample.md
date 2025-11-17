## Steps To Complete

- [ ] Understand that building a personal assistant requires a memory system to learn user preferences and information over time
  - Memory systems allow LLMs to retain information about users across conversations
  - This is an area of active research with many potential applications

### Loading Memories From The Database

- [ ] Review the code structure in `api/chat.ts` and locate the POST route handler

  - This is where incoming chat messages are processed
  - The system prompt currently has a placeholder for memories in XML tags

- [ ] Load memories from the database in the POST route
  - Notice that `loadMemories` and `saveMemories` are already imported at the top of the file

```ts
import { loadMemories, saveMemories, type DB } from "./memory-persistence.ts";
```

- Use the `loadMemories()` function to fetch memories from the database
- Store the result in a variable (replace the TODO comment)

```ts
// TODO: Use the loadMemories function to load the memories from the database
const memories = await loadMemories();
```

### Formatting Memories For The System Prompt

- [ ] Review the `formatMemory()` function that's already defined in the file
  - This function takes a single memory item and formats it nicely for display

```ts
const formatMemory = (memory: DB.MemoryItem) => {
  return [`Memory: ${memory.memory}`, `Created At: ${memory.createdAt}`].join(
    "\n"
  );
};
```

- [ ] Format the loaded memories for display in the system prompt
  - Use the `formatMemory()` function to format each memory item
  - Map over the memories array and join them with newlines
  - Store the result in the `memoriesText` variable (replace the TODO comment)

```ts
// TODO: Format the memories to display in the UI using the formatMemory function
const memoriesText = memories.map(formatMemory).join("\n\n");
```

### Extracting New Memories

- [ ] Understand the memory extraction process that happens after each response
  - The `onFinish` callback runs after the model responds
  - This is where new memories should be extracted and saved

```ts
onFinish: async (response) => {
  const allMessages = [...messages, ...response.messages];

  // TODO: Generate the memories using the generateObject function
  // Pass it the entire message history and the existing memories
  // Write a system prompt that tells the LLM to only focus on permanent memories
  // and not temporary or situational information
  const memoriesResult = TODO;

  const newMemories = memoriesResult.object.memories;

  // TODO: Save the new memories to the database using the saveMemories function
},
```

- [ ] Generate new memories from the conversation using `generateObject()`

  - Locate the TODO in the `onFinish` callback
  - Create an array of all messages (user messages + assistant response)
  - Use `generateObject()` to analyze the full conversation and extract memories

- [ ] Extract the memories from the result object
  - After `generateObject()` completes, access the memories array
  - This is stored in `memoriesResult.object.memories`

```ts
const newMemories = memoriesResult.object.memories;
```

### Saving And Logging Memories

- [ ] Add a console log to see the extracted memories as they're created
  - Log the `newMemories` array so you can track what's being saved
  - This helps verify the memory extraction is working correctly

```ts
console.log("newMemories", newMemories);
```

- [ ] Save the extracted memories to the database
  - Create memory objects with required fields: `id`, `memory`, and `createdAt`
  - Use `generateId()` for each memory's id
  - Use `new Date().toISOString()` for the timestamp
  - Call `saveMemories()` to persist them to the database

```ts
const newMemories = memoriesResult.object.memories;

console.log("newMemories", newMemories);

saveMemories(
  // TODO: Map over the newMemories array and create memory objects with the required fields
  TODO
);
```

### Testing The Memory System

- [ ] Run the application with `pnpm run dev`

  - The dev server will start and be available at `localhost:3000`

- [ ] Open `localhost:3000` in your browser

  - You should see the chat interface with the pre-filled message "Interview me about my life and work. Ask one question at a time."

- [ ] Send the initial message and observe the conversation

  - The assistant will ask you questions about your life and work
  - Answer the questions to provide material for memory extraction

- [ ] Check the server console for memory extraction logs
  - Look for output like this showing what memories were extracted:

```txt
newMemories [
  'User works as a software engineer',
  'User is learning TypeScript',
  'User prefers concise explanations'
]
```

- [ ] Inspect the generated `data/memories.local.json` file
  - After several exchanges, navigate to the `data` directory
  - Open `memories.local.json` to see the stored memories
  - The file should look something like this:

```json
{
  "memories": [
    {
      "id": "a1b2c3d4",
      "memory": "User works as a software engineer",
      "createdAt": "2024-01-15T10:30:45.123Z"
    },
    {
      "id": "e5f6g7h8",
      "memory": "User is learning TypeScript",
      "createdAt": "2024-01-15T10:31:22.456Z"
    },
    {
      "id": "i9j0k1l2",
      "memory": "User prefers concise explanations",
      "createdAt": "2024-01-15T10:32:01.789Z"
    },
    {
      "id": "m3n4o5p6",
      "memory": "User has a dog named Max",
      "createdAt": "2024-01-15T10:33:15.234Z"
    }
  ]
}
```

- [ ] Test the memory system with multiple conversations
  - Have several exchanges with the assistant
  - Check that new memories are added to the database
  - Verify that memories persist across new conversations (the assistant should reference them in the system prompt)
