# PRD: Video Editor Clip Sections

## Problem Statement

User creates course videos by recording and editing clips in a flat timeline. When exporting to YouTube, needs to provide chapter timestamps in descriptions (e.g., "0:00 Introduction", "2:34 Setup"). Currently:
- No way to mark where clip sections begin in the timeline
- Must manually calculate timestamps from clip durations
- Difficult to navigate long videos during editing
- Can't visually organize clips into logical groups

This makes YouTube chapter creation time-consuming and error-prone.

## Solution

Add clip section markers to video timeline as organizational dividers. Clip sections:
- Appear as labeled divider lines between clips
- Can be added via Stream Deck button at insertion point
- Move up/down with clips using unified ordering
- Auto-generate YouTube timestamps on export

## User Stories

1. As a video editor, I want to add a clip section marker at my insertion point, so that I can mark where a new chapter begins
2. As a video editor, I want to add clip sections via Stream Deck button, so that I can mark clip sections while recording without touching keyboard
3. As a video editor, I want to name each clip section, so that the names appear in YouTube chapters
4. As a video editor, I want clip sections to appear as divider lines in the timeline, so that I can visually distinguish them from clips
5. As a video editor, I want clip sections to move up and down like clips, so that I can reorganize video structure
6. As a video editor, I want to reorder clip sections by dragging or using Alt+Up/Down, so that I can adjust chapter ordering
7. As a video editor, I want to delete clip sections I no longer need, so that I can remove incorrect chapter markers
8. As a video editor, I want clip sections to be archived (not hard deleted), so that I can potentially restore them later
9. As a video editor, I want to edit clip section names after creation, so that I can fix typos or improve chapter titles
10. As a video editor, I want a modal to appear when adding a clip section, so that I can name it immediately
11. As a video editor, I want to dismiss the naming modal, so that the clip section is created with a default name if I'm in a hurry
12. As a video editor, I want clip sections to have default names like "Section 1", "Section 2", so that I don't have to name them during recording
13. As a video editor, I want the insertion point to move after a newly created clip section, so that subsequent clips fall under that clip section
14. As a video editor, I want to place the insertion point after a clip section, so that I can control where new clips are added
15. As a video editor, I want clip sections to be selectable like clips, so that I can perform bulk operations
16. As a video editor, I want to select multiple clip sections and clips together, so that I can delete multiple items at once
17. As a video editor, I want right-click context menu on clip sections, so that I can access Edit/Move/Delete actions
18. As a video editor, I want playback to continue through clip sections, so that my workflow isn't interrupted by chapter markers
19. As a video editor, I want clip sections stored separately from clips in the database, so that the data model is clean
20. As a video editor, I want clip sections and clips to share the same ordering space, so that they can be freely interleaved
21. As a video editor, I want to move clips above and below clip sections, so that I can reorganize content structure
22. As a video editor, I want clip sections to be moveable without constraints, so that I can place them anywhere in the timeline
23. As a video editor, I want clip sections at the beginning of my video, so that I can have an intro chapter
24. As a video editor, I want clip sections at the end of my video, so that I can have an outro chapter
25. As a video editor, I want clip sections to persist across sessions, so that my chapter markers are saved
26. As a video editor, I want to export my video with YouTube timestamps, so that chapters appear automatically in YouTube
27. As a video editor, I want timestamps calculated from clip durations, so that I don't have to do math manually
28. As a video editor, I want timestamps to update automatically when I reorder clips, so that chapters stay accurate
29. As a video editor, I want the YouTube export format to be "0:00 Section Name", so that it matches YouTube's chapter format
30. As a video editor, I want to delete clip sections using the Delete key, so that I can use keyboard shortcuts consistently
31. As a video editor, I want the same keyboard shortcuts for clip sections as clips, so that the UX is consistent
32. As a video editor, I want clip sections and clips in a unified array, so that order-dependent logic works correctly
33. As a video editor, I want clip sections to use fractional ordering like clips, so that I can insert between any two items
34. As a video editor, I want clip sections to cascade delete when I delete a video, so that orphaned clip sections don't remain
35. As a video editor, I want to see which clips belong to which clip section by looking at dividers, so that navigation is easy
36. As a video editor, I want clip sections to have different visual styling than clips, so that I can distinguish them at a glance

## Implementation Decisions

### Data Model
- **Separate table**: New `clipSections` table (not type discriminator in clips table) - avoids collision with existing course `sections` table
- **Schema**: `id` (UUID), `videoId` (FK to videos, cascade delete), `name` (text, required), `order` (varchar COLLATE "C"), `archived` (boolean, default false)
- **Unified ordering**: Clip sections and clips share same fractional ordering space using varchar order field
- **Minimal metadata**: Only name field - no description, color, icons, or timestamp overrides

### Frontend State
- **Unified items array**: Single `(Clip | ClipSection)[]` array in state - order-dependent logic requires single source
- **Type discriminator**: Add `type: "clip"` to Clip, `type: "clip-section"` to ClipSection
- **Insertion point extension**: Add `after-clip-section` variant to insertion point type (alongside `start`, `end`, `after-clip`)
- **Optimistic updates**: Clip sections added optimistically before DB confirmation, like clips

### Visual Design
- **Divider line**: Horizontal line spanning timeline width (not card-like clips)
- **Label**: Clip section name displayed on divider
- **Selectable**: Click to select, participates in multi-select operations
- **No grouping**: Clips don't show visual indication of clip section membership

### User Interactions
- **Add via Stream Deck**: HTTP endpoint `/api/add-clip-section` → WebSocket message → create clip section at insertion point
- **Naming flow**: Dismissible modal appears after creation. Default name "Section 1", "Section 2" (sequential). Dismiss/cancel keeps clip section with default name.
- **After creation**: Insertion point moves to after new clip section
- **Edit**: Right-click → Edit → modal to rename (no keyboard shortcut)
- **Move**: Alt+Up/Down OR right-click → Move Up/Down
- **Delete**: Delete key OR right-click → Delete (archives clip section)
- **No constraints**: Clip sections can be placed anywhere (first, last, middle)

### Playback & Export
- **Playback**: Nothing happens at clip section markers - playback continues normally
- **YouTube export**: Calculate timestamps by summing clip durations before each clip section. Format: "0:00 Section Name"

### Database Operations
- **Reordering**: Fetch combined clips+clipSections, sort by order, calculate new fractional position, update single item
- **Archiving**: Soft delete via `archived: true` (same pattern as clips)
- **Queries**: Load clipSections with clips, sort by order field

### API Routes
- Four new routes: `clip-sections.create.ts`, `clip-sections.update.ts`, `clip-sections.archive.ts`, `clip-sections.reorder.ts`
- Follow same patterns as clip routes

### Stream Deck Integration
- New HTTP endpoint on port 5174
- Broadcasts WebSocket message on port 5172
- React component handles message and shows modal

## Further Notes

- Clip section counter for default names should be video-scoped (not global)
- Modal should auto-focus name input field for quick editing
- Consider adding clip section count indicator in video metadata display
- Future enhancement: keyboard shortcut to add clip section (e.g., 'S' key) if Stream Deck not available
- Future enhancement: clip section collapse/expand functionality to hide clips under clip sections
- Fractional ordering library (`generateNKeysBetween`) already handles combined item reordering
