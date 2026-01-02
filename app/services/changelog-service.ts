type VersionWithStructure = {
  id: string;
  name: string;
  createdAt: Date;
  sections: Array<{
    id: string;
    path: string;
    previousVersionSectionId: string | null;
    lessons: Array<{
      id: string;
      path: string;
      previousVersionLessonId: string | null;
      videos: Array<{
        id: string;
        path: string;
        clips: Array<{
          id: string;
          text: string;
        }>;
      }>;
    }>;
  }>;
};

type VersionChanges = {
  newLessons: Array<{ sectionPath: string; lessonPath: string }>;
  renamedSections: Array<{ oldPath: string; newPath: string }>;
  renamedLessons: Array<{
    sectionPath: string;
    oldPath: string;
    newPath: string;
  }>;
  contentChanges: Array<{ sectionPath: string; lessonPath: string }>;
  deletedSections: Array<{ sectionPath: string }>;
  deletedLessons: Array<{ sectionPath: string; lessonPath: string }>;
};

/**
 * Get the transcript text for a lesson by combining all clip texts.
 */
function getLessonTranscript(
  lesson: VersionWithStructure["sections"][number]["lessons"][number]
): string {
  return lesson.videos
    .flatMap((v) => v.clips.map((c) => c.text))
    .join(" ")
    .trim();
}

/**
 * Build a lookup map from lesson ID to its data for a given version.
 */
function buildLessonLookup(version: VersionWithStructure): Map<
  string,
  {
    sectionPath: string;
    lessonPath: string;
    transcript: string;
  }
> {
  const lookup = new Map<
    string,
    { sectionPath: string; lessonPath: string; transcript: string }
  >();

  for (const section of version.sections) {
    for (const lesson of section.lessons) {
      lookup.set(lesson.id, {
        sectionPath: section.path,
        lessonPath: lesson.path,
        transcript: getLessonTranscript(lesson),
      });
    }
  }

  return lookup;
}

/**
 * Build a lookup map from section ID to its path for a given version.
 */
function buildSectionLookup(version: VersionWithStructure): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const section of version.sections) {
    lookup.set(section.id, section.path);
  }
  return lookup;
}

/**
 * Compare a version to its previous version and detect changes.
 * Returns null if there's no previous version to compare against.
 */
function detectChanges(
  currentVersion: VersionWithStructure,
  previousVersion: VersionWithStructure | undefined
): VersionChanges | null {
  if (!previousVersion) {
    return null;
  }

  const changes: VersionChanges = {
    newLessons: [],
    renamedSections: [],
    renamedLessons: [],
    contentChanges: [],
    deletedSections: [],
    deletedLessons: [],
  };

  const prevLessonLookup = buildLessonLookup(previousVersion);
  const prevSectionLookup = buildSectionLookup(previousVersion);

  // Track which sections we've already recorded as renamed
  const renamedSectionIds = new Set<string>();

  for (const section of currentVersion.sections) {
    // Check for renamed sections
    if (section.previousVersionSectionId) {
      const prevSectionPath = prevSectionLookup.get(
        section.previousVersionSectionId
      );
      if (prevSectionPath && prevSectionPath !== section.path) {
        if (!renamedSectionIds.has(section.previousVersionSectionId)) {
          changes.renamedSections.push({
            oldPath: prevSectionPath,
            newPath: section.path,
          });
          renamedSectionIds.add(section.previousVersionSectionId);
        }
      }
    }

    for (const lesson of section.lessons) {
      if (!lesson.previousVersionLessonId) {
        // New lesson (no previous version reference)
        changes.newLessons.push({
          sectionPath: section.path,
          lessonPath: lesson.path,
        });
      } else {
        // Check for renames and content changes
        const prevLesson = prevLessonLookup.get(lesson.previousVersionLessonId);
        if (prevLesson) {
          // Check for path rename
          if (prevLesson.lessonPath !== lesson.path) {
            changes.renamedLessons.push({
              sectionPath: section.path,
              oldPath: prevLesson.lessonPath,
              newPath: lesson.path,
            });
          }

          // Check for content changes via transcript comparison
          const currentTranscript = getLessonTranscript(lesson);
          if (prevLesson.transcript !== currentTranscript) {
            changes.contentChanges.push({
              sectionPath: section.path,
              lessonPath: lesson.path,
            });
          }
        }
      }
    }
  }

  // Detect deleted sections and lessons
  // Build sets of section/lesson IDs that are referenced in current version
  const referencedSectionIds = new Set<string>();
  const referencedLessonIds = new Set<string>();

  for (const section of currentVersion.sections) {
    if (section.previousVersionSectionId) {
      referencedSectionIds.add(section.previousVersionSectionId);
    }
    for (const lesson of section.lessons) {
      if (lesson.previousVersionLessonId) {
        referencedLessonIds.add(lesson.previousVersionLessonId);
      }
    }
  }

  // Find sections in previous version that aren't referenced
  for (const prevSection of previousVersion.sections) {
    if (!referencedSectionIds.has(prevSection.id)) {
      changes.deletedSections.push({ sectionPath: prevSection.path });
    } else {
      // Section still exists, check for deleted lessons within it
      for (const prevLesson of prevSection.lessons) {
        if (!referencedLessonIds.has(prevLesson.id)) {
          changes.deletedLessons.push({
            sectionPath: prevSection.path,
            lessonPath: prevLesson.path,
          });
        }
      }
    }
  }

  return changes;
}

/**
 * Format a path for display (remove leading numbers like "01-" prefix).
 */
function formatPath(path: string): string {
  return path.replace(/^\d+-/, "").replace(/-/g, " ");
}

/**
 * Generate a changelog markdown string from all versions.
 * Versions should be in reverse chronological order (newest first).
 */
export function generateChangelog(
  versions: VersionWithStructure[]
): string {
  if (versions.length === 0) {
    return "# Changelog\n\nNo versions found.\n";
  }

  const lines: string[] = ["# Changelog", ""];

  for (let i = 0; i < versions.length; i++) {
    const currentVersion = versions[i]!;
    const previousVersion = versions[i + 1];

    // Format date as YYYY-MM-DD
    const dateStr = currentVersion.createdAt.toISOString().split("T")[0];

    lines.push(`## ${currentVersion.name} (${dateStr})`);
    lines.push("");

    // First/oldest version
    if (!previousVersion) {
      lines.push("Initial version.");
      lines.push("");
      continue;
    }

    const changes = detectChanges(currentVersion, previousVersion);

    if (!changes) {
      lines.push("No changes detected.");
      lines.push("");
      continue;
    }

    const hasChanges =
      changes.newLessons.length > 0 ||
      changes.renamedSections.length > 0 ||
      changes.renamedLessons.length > 0 ||
      changes.contentChanges.length > 0 ||
      changes.deletedSections.length > 0 ||
      changes.deletedLessons.length > 0;

    if (!hasChanges) {
      lines.push("No significant changes.");
      lines.push("");
      continue;
    }

    // New Lessons
    if (changes.newLessons.length > 0) {
      lines.push("### New Lessons");
      lines.push("");
      for (const lesson of changes.newLessons) {
        lines.push(
          `- ${formatPath(lesson.sectionPath)} / ${formatPath(lesson.lessonPath)}`
        );
      }
      lines.push("");
    }

    // Renamed (sections and lessons combined)
    if (changes.renamedSections.length > 0 || changes.renamedLessons.length > 0) {
      lines.push("### Renamed");
      lines.push("");
      for (const section of changes.renamedSections) {
        lines.push(
          `- ${formatPath(section.oldPath)} → ${formatPath(section.newPath)}`
        );
      }
      for (const lesson of changes.renamedLessons) {
        lines.push(
          `- ${formatPath(lesson.sectionPath)} / ${formatPath(lesson.oldPath)} → ${formatPath(lesson.newPath)}`
        );
      }
      lines.push("");
    }

    // Content Changes
    if (changes.contentChanges.length > 0) {
      lines.push("### Content Changes");
      lines.push("");
      for (const change of changes.contentChanges) {
        lines.push(
          `- ${formatPath(change.sectionPath)} / ${formatPath(change.lessonPath)}`
        );
      }
      lines.push("");
    }

    // Deleted
    if (changes.deletedSections.length > 0 || changes.deletedLessons.length > 0) {
      lines.push("### Deleted");
      lines.push("");
      for (const section of changes.deletedSections) {
        lines.push(`- ${formatPath(section.sectionPath)} (entire section)`);
      }
      for (const lesson of changes.deletedLessons) {
        lines.push(
          `- ${formatPath(lesson.sectionPath)} / ${formatPath(lesson.lessonPath)}`
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
