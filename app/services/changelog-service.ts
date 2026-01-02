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
 * Organize changes by section for hierarchical display.
 */
type SectionChanges = {
  newLessons: string[];
  renamedLessons: Array<{ oldPath: string; newPath: string }>;
  deletedLessons: string[];
  sectionRenamed?: { oldPath: string; newPath: string };
};

function organizeChangesBySection(
  changes: VersionChanges,
  currentVersion: VersionWithStructure
): Map<string, SectionChanges> {
  const sectionMap = new Map<string, SectionChanges>();

  // Build a mapping from old section paths to new section paths (for renamed sections)
  const oldToNewSectionPath = new Map<string, string>();
  for (const section of changes.renamedSections) {
    oldToNewSectionPath.set(section.oldPath, section.newPath);
  }

  // Helper to get or create section entry
  const getSection = (sectionPath: string): SectionChanges => {
    if (!sectionMap.has(sectionPath)) {
      sectionMap.set(sectionPath, {
        newLessons: [],
        renamedLessons: [],
        deletedLessons: [],
      });
    }
    return sectionMap.get(sectionPath)!;
  };

  // Add new lessons
  for (const lesson of changes.newLessons) {
    getSection(lesson.sectionPath).newLessons.push(lesson.lessonPath);
  }

  // Add renamed lessons
  for (const lesson of changes.renamedLessons) {
    getSection(lesson.sectionPath).renamedLessons.push({
      oldPath: lesson.oldPath,
      newPath: lesson.newPath,
    });
  }

  // Add deleted lessons (map old section path to new if section was renamed)
  for (const lesson of changes.deletedLessons) {
    const effectiveSectionPath =
      oldToNewSectionPath.get(lesson.sectionPath) ?? lesson.sectionPath;
    getSection(effectiveSectionPath).deletedLessons.push(lesson.lessonPath);
  }

  // Add section renames
  for (const section of changes.renamedSections) {
    const sectionEntry = getSection(section.newPath);
    sectionEntry.sectionRenamed = {
      oldPath: section.oldPath,
      newPath: section.newPath,
    };
  }

  // Include sections from current version that have changes to preserve order
  const orderedSections: Array<[string, SectionChanges]> = [];
  for (const section of currentVersion.sections) {
    if (sectionMap.has(section.path)) {
      orderedSections.push([section.path, sectionMap.get(section.path)!]);
    }
  }
  // Add deleted sections (by their old path) at the end
  for (const deleted of changes.deletedSections) {
    if (!orderedSections.some(([path]) => path === deleted.sectionPath)) {
      orderedSections.push([
        deleted.sectionPath,
        { newLessons: [], renamedLessons: [], deletedLessons: [] },
      ]);
    }
  }

  return new Map(orderedSections);
}

/**
 * Generate a changelog markdown string from all versions.
 * Versions should be in reverse chronological order (newest first).
 * Organized by section hierarchy: Version > Section > (New/Renamed/Deleted)
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

    lines.push(`## ${currentVersion.name}`);
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

    // Organize by section hierarchy
    const sectionChanges = organizeChangesBySection(changes, currentVersion);

    // Deleted sections (entire section removed)
    if (changes.deletedSections.length > 0) {
      lines.push("### Deleted Sections");
      lines.push("");
      for (const section of changes.deletedSections) {
        lines.push(`- ${formatPath(section.sectionPath)}`);
      }
      lines.push("");
    }

    // Each section with changes
    for (const [sectionPath, sectionChange] of sectionChanges) {
      // Skip if this section was entirely deleted
      if (changes.deletedSections.some((s) => s.sectionPath === sectionPath)) {
        continue;
      }

      const hasLessonChanges =
        sectionChange.newLessons.length > 0 ||
        sectionChange.renamedLessons.length > 0 ||
        sectionChange.deletedLessons.length > 0 ||
        sectionChange.sectionRenamed;

      if (!hasLessonChanges) continue;

      // Section heading (use new name if renamed)
      const displayPath = sectionChange.sectionRenamed
        ? sectionChange.sectionRenamed.newPath
        : sectionPath;
      lines.push(`### ${formatPath(displayPath)}`);
      lines.push("");

      // Section rename note
      if (sectionChange.sectionRenamed) {
        lines.push(
          `*Renamed from "${formatPath(sectionChange.sectionRenamed.oldPath)}"*`
        );
        lines.push("");
      }

      // New Lessons within section
      if (sectionChange.newLessons.length > 0) {
        lines.push("#### New Lessons");
        lines.push("");
        for (const lessonPath of sectionChange.newLessons) {
          lines.push(`- ${formatPath(lessonPath)}`);
        }
        lines.push("");
      }

      // Renamed Lessons within section
      if (sectionChange.renamedLessons.length > 0) {
        lines.push("#### Renamed");
        lines.push("");
        for (const lesson of sectionChange.renamedLessons) {
          lines.push(
            `- ${formatPath(lesson.oldPath)} → ${formatPath(lesson.newPath)}`
          );
        }
        lines.push("");
      }

      // Deleted Lessons within section
      if (sectionChange.deletedLessons.length > 0) {
        lines.push("#### Deleted");
        lines.push("");
        for (const lessonPath of sectionChange.deletedLessons) {
          lines.push(`- ${formatPath(lessonPath)}`);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}
