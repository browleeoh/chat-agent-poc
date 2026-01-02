import { db } from "@/db/db";
import { clips, lessons, repos, repoVersions, sections, videos } from "@/db/schema";
import type { AppendFromOBSSchema } from "@/routes/videos.$videoId.append-from-obs";
import {
  AmbiguousRepoUpdateError,
  CannotDeleteNonLatestVersionError,
  CannotDeleteOnlyVersionError,
  NotFoundError,
  NotLatestVersionError,
  UnknownDBServiceError,
} from "@/services/db-service-errors";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { Effect } from "effect";
import { generateNKeysBetween } from "fractional-indexing";

const makeDbCall = <T>(fn: () => Promise<T>) => {
  return Effect.tryPromise({
    try: fn,
    catch: (e) => new UnknownDBServiceError({ cause: e }),
  });
};

export class DBService extends Effect.Service<DBService>()("DBService", {
  effect: Effect.gen(function* () {
    const getClipById = Effect.fn("getClipById")(function* (clipId: string) {
      const clip = yield* makeDbCall(() =>
        db.query.clips.findFirst({
          where: eq(clips.id, clipId),
        })
      );

      if (!clip) {
        return yield* new NotFoundError({
          type: "getClipById",
          params: { clipId },
        });
      }

      return clip;
    });

    const getClipsByIds = Effect.fn("getClipsByIds")(function* (
      clipIds: readonly string[]
    ) {
      const foundClips = yield* makeDbCall(() =>
        db.query.clips.findMany({
          where: inArray(clips.id, clipIds),
        })
      );

      return foundClips;
    });

    const updateClip = Effect.fn("updateClip")(function* (
      clipId: string,
      updatedClip: {
        text?: string;
        scene?: string;
        profile?: string;
        transcribedAt?: Date;
        beatType?: string;
      }
    ) {
      const [clip] = yield* makeDbCall(() =>
        db
          .update(clips)
          .set(updatedClip)
          .where(eq(clips.id, clipId))
          .returning()
      );

      return clip!;
    });

    const archiveClip = Effect.fn("archiveClip")(function* (clipId: string) {
      const clipExists = yield* makeDbCall(() =>
        db.query.clips.findFirst({
          where: eq(clips.id, clipId),
        })
      );

      if (!clipExists) {
        return yield* new NotFoundError({
          type: "archiveClip",
          params: { clipId },
        });
      }

      const clip = yield* makeDbCall(() =>
        db.update(clips).set({ archived: true }).where(eq(clips.id, clipId))
      );

      return clip;
    });

    const getRepoById = Effect.fn("getRepoById")(function* (id: string) {
      const repo = yield* makeDbCall(() =>
        db.query.repos.findFirst({
          where: eq(repos.id, id),
        })
      );

      if (!repo) {
        return yield* new NotFoundError({
          type: "getRepo",
          params: { id },
        });
      }

      return repo;
    });

    const getRepoByFilePath = Effect.fn("getRepoByFilePath")(function* (
      filePath: string
    ) {
      const repo = yield* makeDbCall(() =>
        db.query.repos.findFirst({
          where: eq(repos.filePath, filePath),
        })
      );

      if (!repo) {
        return yield* new NotFoundError({
          type: "getRepoByFilePath",
          params: { filePath },
        });
      }

      return repo;
    });

    const getLessonById = Effect.fn("getLessonById")(function* (id: string) {
      const lesson = yield* makeDbCall(() =>
        db.query.lessons.findFirst({
          where: eq(lessons.id, id),
          with: {
            videos: {
              orderBy: asc(videos.path),
            },
          },
        })
      );

      if (!lesson) {
        return yield* new NotFoundError({
          type: "getLessonById",
          params: { id },
        });
      }

      return lesson;
    });

    const getLessonWithHierarchyById = Effect.fn("getLessonWithHierarchyById")(
      function* (id: string) {
        const lesson = yield* makeDbCall(() =>
          db.query.lessons.findFirst({
            where: eq(lessons.id, id),
            with: {
              section: {
                with: {
                  repo: true,
                },
              },
            },
          })
        );

        if (!lesson) {
          return yield* new NotFoundError({
            type: "getLessonWithHierarchyById",
            params: { id },
          });
        }

        return lesson;
      }
    );

    const getVideoDeepById = Effect.fn("getVideoById")(function* (id: string) {
      const video = yield* makeDbCall(() =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          with: {
            lesson: {
              with: {
                section: {
                  with: {
                    repo: true,
                  },
                },
              },
            },
          },
        })
      );

      if (!video) {
        return yield* new NotFoundError({
          type: "getVideoById",
          params: { id },
        });
      }

      return video;
    });

    const getStandaloneVideos = Effect.fn("getStandaloneVideos")(function* () {
      const standaloneVideos = yield* makeDbCall(() =>
        db.query.videos.findMany({
          where: isNull(videos.lessonId),
          orderBy: desc(videos.createdAt),
          with: {
            clips: {
              orderBy: asc(clips.order),
              where: eq(clips.archived, false),
            },
          },
        })
      );

      return standaloneVideos;
    });

    const getVideoWithClipsById = Effect.fn("getVideoWithClipsById")(function* (
      id: string,
      opts?: {
        withArchived?: boolean;
      }
    ) {
      const video = yield* makeDbCall(() =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          with: {
            lesson: {
              with: {
                section: {
                  with: {
                    repo: true,
                  },
                },
                videos: true,
              },
            },
            clips: {
              orderBy: asc(clips.order),
              ...(opts?.withArchived
                ? {}
                : { where: eq(clips.archived, false) }),
            },
          },
        })
      );

      if (!video) {
        return yield* new NotFoundError({
          type: "getVideoWithClipsById",
          params: { id },
        });
      }

      return video;
    });

    const getRepoWithSectionsById = Effect.fn("getRepoWithSectionsById")(
      function* (id: string) {
        const repo = yield* makeDbCall(() =>
          db.query.repos.findFirst({
            where: eq(repos.id, id),
            with: {
              sections: {
                with: {
                  lessons: {
                    with: {
                      videos: {
                        orderBy: asc(videos.path),
                        with: {
                          clips: {
                            orderBy: asc(clips.order),
                            where: eq(clips.archived, false),
                          },
                        },
                      },
                    },
                    orderBy: asc(lessons.order),
                  },
                },
                orderBy: asc(sections.order),
              },
            },
          })
        );

        if (!repo) {
          return yield* new NotFoundError({
            type: "getRepoWithSections",
            params: { id },
          });
        }

        return repo;
      }
    );

    return {
      getClipById,
      getClipsByIds,
      updateClip,
      getLessonById,
      getLessonWithHierarchyById,
      appendClips: Effect.fn("addClips")(function* (opts: {
        videoId: string;
        insertionPoint: AppendFromOBSSchema["insertionPoint"];
        clips: readonly {
          inputVideo: string;
          startTime: number;
          endTime: number;
        }[];
      }) {
        const { videoId, insertionPoint, clips: inputClips } = opts;
        let prevClipOrder: string | null | undefined = null;
        let nextClipOrder: string | null | undefined = null;

        const allClips = yield* makeDbCall(() =>
          db.query.clips.findMany({
            where: and(eq(clips.videoId, videoId), eq(clips.archived, false)),
            orderBy: asc(clips.order),
          })
        );

        if (insertionPoint.type === "start") {
          // Insert before all clips
          prevClipOrder = null;
          const firstClip = allClips[0];
          nextClipOrder = firstClip?.order;
        } else if (insertionPoint.type === "after-clip") {
          // Insert after specific clip
          const insertAfterClipIndex = allClips.findIndex(
            (c) => c.id === insertionPoint.databaseClipId
          );

          if (insertAfterClipIndex === -1) {
            return yield* new NotFoundError({
              type: "appendClips",
              params: { videoId, insertionPoint },
              message: `Could not find a clip to insert after`,
            });
          }

          const insertAfterClip = allClips[insertAfterClipIndex];
          prevClipOrder = insertAfterClip?.order;

          const nextClip = allClips[insertAfterClipIndex + 1];

          nextClipOrder = nextClip?.order;
        }

        const orders = generateNKeysBetween(
          prevClipOrder ?? null,
          nextClipOrder ?? null,
          inputClips.length
        );

        const clipsResult = yield* makeDbCall(() =>
          db
            .insert(clips)
            .values(
              inputClips.map((clip, index) => ({
                ...clip,
                videoId,
                videoFilename: clip.inputVideo,
                sourceStartTime: clip.startTime,
                sourceEndTime: clip.endTime,
                order: orders[index]!,
                archived: false,
                text: "",
              }))
            )
            .returning()
        );

        return clipsResult;
      }),
      createVideo: Effect.fn("createVideo")(function* (
        lessonId: string,
        video: {
          path: string;
          originalFootagePath: string;
        }
      ) {
        const videoResults = yield* makeDbCall(() =>
          db
            .insert(videos)
            .values({ ...video, lessonId })
            .returning()
        );

        const videoResult = videoResults[0];

        if (!videoResult) {
          return yield* new UnknownDBServiceError({
            cause: "No video was returned from the database",
          });
        }

        return videoResult;
      }),
      hasOriginalFootagePathAlreadyBeenUsed: Effect.fn(
        "hasOriginalFootagePathAlreadyBeenUsed"
      )(function* (originalFootagePath: string) {
        const foundVideo = yield* makeDbCall(() =>
          db.query.videos.findFirst({
            where: eq(videos.originalFootagePath, originalFootagePath),
          })
        );

        return !!foundVideo;
      }),
      updateVideo: Effect.fn("updateVideo")(function* (
        videoId: string,
        video: {
          originalFootagePath: string;
        }
      ) {
        const videoResult = yield* makeDbCall(() =>
          db.update(videos).set(video).where(eq(videos.id, videoId))
        );

        return videoResult;
      }),
      deleteVideo: Effect.fn("deleteVideo")(function* (videoId: string) {
        const videoResult = yield* makeDbCall(() =>
          db.delete(videos).where(eq(videos.id, videoId))
        );

        return videoResult;
      }),
      getRepoById,
      getRepoByFilePath,
      getRepoWithSectionsById,
      getRepoWithSectionsByFilePath: Effect.fn("getRepoWithSectionsByFilePath")(
        function* (filePath: string) {
          const repo = yield* getRepoByFilePath(filePath);

          return yield* getRepoWithSectionsById(repo.id);
        }
      ),
      getRepos: Effect.fn("getRepos")(function* () {
        const repos = yield* makeDbCall(() => db.query.repos.findMany());
        return repos;
      }),
      archiveClip,
      getVideoById: getVideoDeepById,
      getVideoWithClipsById: getVideoWithClipsById,
      getStandaloneVideos,
      createRepo: Effect.fn("createRepo")(function* (input: {
        filePath: string;
        name: string;
      }) {
        const reposResult = yield* makeDbCall(() =>
          db.insert(repos).values(input).returning()
        );

        const repo = reposResult[0];

        if (!repo) {
          return yield* new UnknownDBServiceError({
            cause: "No repo was returned from the database",
          });
        }

        return repo;
      }),
      createSections: Effect.fn("createSections")(function* ({
        repoId,
        sections: newSections,
        repoVersionId,
      }: {
        repoId: string;
        sections: {
          sectionPathWithNumber: string;
          sectionNumber: number;
        }[];
        repoVersionId?: string;
      }) {
        const sectionResult = yield* makeDbCall(() =>
          db
            .insert(sections)
            .values(
              newSections.map((section) => ({
                repoId,
                repoVersionId,
                path: section.sectionPathWithNumber,
                order: section.sectionNumber,
              }))
            )
            .returning()
        );

        return sectionResult;
      }),

      createLessons: Effect.fn("createLessons")(function* (
        sectionId: string,
        newLessons: {
          lessonPathWithNumber: string;
          lessonNumber: number;
        }[]
      ) {
        const lessonResult = yield* makeDbCall(() =>
          db
            .insert(lessons)
            .values(
              newLessons.map((lesson) => ({
                sectionId,
                path: lesson.lessonPathWithNumber,
                order: lesson.lessonNumber,
              }))
            )
            .returning()
        );

        return lessonResult;
      }),
      updateLesson: Effect.fn("updateLesson")(function* (
        lessonId: string,
        lesson: {
          path?: string;
          sectionId?: string;
          lessonNumber?: number;
        }
      ) {
        const lessonResult = yield* makeDbCall(() =>
          db
            .update(lessons)
            .set({
              path: lesson.path,
              sectionId: lesson.sectionId,
              order: lesson.lessonNumber,
            })
            .where(eq(lessons.id, lessonId))
        );

        return lessonResult;
      }),
      deleteLesson: Effect.fn("deleteLesson")(function* (lessonId: string) {
        const lessonResult = yield* makeDbCall(() =>
          db.delete(lessons).where(eq(lessons.id, lessonId))
        );

        return lessonResult;
      }),
      deleteSection: Effect.fn("deleteSection")(function* (sectionId: string) {
        const sectionResult = yield* makeDbCall(() =>
          db.delete(sections).where(eq(sections.id, sectionId))
        );

        return sectionResult;
      }),
      getNextVideoId: Effect.fn("getNextVideoId")(function* (
        currentVideoId: string
      ) {
        const currentVideo = yield* getVideoWithClipsById(currentVideoId);
        const currentLesson = currentVideo.lesson;
        if (!currentLesson) return null; // Standalone videos have no next/prev
        const currentSection = currentLesson.section;
        const repo = currentSection.repo;

        // Get all videos in current lesson sorted by path
        const videosInLesson = currentLesson.videos.sort((a, b) =>
          a.path.localeCompare(b.path)
        );
        const currentVideoIndex = videosInLesson.findIndex(
          (v) => v.id === currentVideoId
        );

        // Try next video in current lesson
        if (currentVideoIndex < videosInLesson.length - 1) {
          return videosInLesson[currentVideoIndex + 1]?.id ?? null;
        }

        // Need to get all sections and lessons to find next
        const repoWithSections = yield* getRepoWithSectionsById(repo.id);

        // Find current lesson in the structure
        for (let sIdx = 0; sIdx < repoWithSections.sections.length; sIdx++) {
          const section = repoWithSections.sections[sIdx]!;
          for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
            const lesson = section.lessons[lIdx]!;
            if (lesson.id === currentLesson.id) {
              // Try next lesson in current section
              if (lIdx < section.lessons.length - 1) {
                const nextLesson = section.lessons[lIdx + 1]!;
                const firstVideo = nextLesson.videos.sort((a, b) =>
                  a.path.localeCompare(b.path)
                )[0];
                return firstVideo?.id ?? null;
              }

              // Try first lesson of next section
              if (sIdx < repoWithSections.sections.length - 1) {
                const nextSection = repoWithSections.sections[sIdx + 1]!;
                const firstLesson = nextSection.lessons[0];
                const firstVideo = firstLesson?.videos.sort((a, b) =>
                  a.path.localeCompare(b.path)
                )[0];
                return firstVideo?.id ?? null;
              }

              // No more videos
              return null;
            }
          }
        }

        return null;
      }),
      getPreviousVideoId: Effect.fn("getPreviousVideoId")(function* (
        currentVideoId: string
      ) {
        const currentVideo = yield* getVideoWithClipsById(currentVideoId);
        const currentLesson = currentVideo.lesson;
        if (!currentLesson) return null; // Standalone videos have no next/prev
        const currentSection = currentLesson.section;
        const repo = currentSection.repo;

        // Get all videos in current lesson sorted by path
        const videosInLesson = currentLesson.videos.sort((a, b) =>
          a.path.localeCompare(b.path)
        );
        const currentVideoIndex = videosInLesson.findIndex(
          (v) => v.id === currentVideoId
        );

        // Try previous video in current lesson
        if (currentVideoIndex > 0) {
          return videosInLesson[currentVideoIndex - 1]?.id ?? null;
        }

        // Need to get all sections and lessons to find previous
        const repoWithSections = yield* getRepoWithSectionsById(repo.id);

        // Find current lesson in the structure
        for (let sIdx = 0; sIdx < repoWithSections.sections.length; sIdx++) {
          const section = repoWithSections.sections[sIdx]!;
          for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
            const lesson = section.lessons[lIdx]!;
            if (lesson.id === currentLesson.id) {
              // Try previous lesson in current section
              if (lIdx > 0) {
                const prevLesson = section.lessons[lIdx - 1]!;
                const videos = prevLesson.videos.sort((a, b) =>
                  a.path.localeCompare(b.path)
                );
                const lastVideo = videos[videos.length - 1];
                return lastVideo?.id ?? null;
              }

              // Try last lesson of previous section
              if (sIdx > 0) {
                const prevSection = repoWithSections.sections[sIdx - 1]!;
                const lastLesson =
                  prevSection.lessons[prevSection.lessons.length - 1];
                const videos = lastLesson?.videos.sort((a, b) =>
                  a.path.localeCompare(b.path)
                );
                const lastVideo = videos?.[videos.length - 1];
                return lastVideo?.id ?? null;
              }

              // No more videos
              return null;
            }
          }
        }

        return null;
      }),
      // Version-related methods
      getRepoVersions: Effect.fn("getRepoVersions")(function* (repoId: string) {
        const versions = yield* makeDbCall(() =>
          db.query.repoVersions.findMany({
            where: eq(repoVersions.repoId, repoId),
            orderBy: desc(repoVersions.createdAt),
          })
        );
        return versions;
      }),
      getLatestRepoVersion: Effect.fn("getLatestRepoVersion")(function* (
        repoId: string
      ) {
        const version = yield* makeDbCall(() =>
          db.query.repoVersions.findFirst({
            where: eq(repoVersions.repoId, repoId),
            orderBy: desc(repoVersions.createdAt),
          })
        );
        return version;
      }),
      getRepoVersionById: Effect.fn("getRepoVersionById")(function* (
        versionId: string
      ) {
        const version = yield* makeDbCall(() =>
          db.query.repoVersions.findFirst({
            where: eq(repoVersions.id, versionId),
          })
        );

        if (!version) {
          return yield* new NotFoundError({
            type: "getRepoVersionById",
            params: { versionId },
          });
        }

        return version;
      }),
      getRepoWithSectionsByVersion: Effect.fn("getRepoWithSectionsByVersion")(
        function* (opts: { repoId: string; versionId: string }) {
          const { repoId, versionId } = opts;
          const repo = yield* makeDbCall(() =>
            db.query.repos.findFirst({
              where: eq(repos.id, repoId),
            })
          );

          if (!repo) {
            return yield* new NotFoundError({
              type: "getRepoWithSectionsByVersion",
              params: { repoId, versionId },
            });
          }

          const versionSections = yield* makeDbCall(() =>
            db.query.sections.findMany({
              where: eq(sections.repoVersionId, versionId),
              orderBy: asc(sections.order),
              with: {
                lessons: {
                  orderBy: asc(lessons.order),
                  with: {
                    videos: {
                      orderBy: asc(videos.path),
                      with: {
                        clips: {
                          orderBy: asc(clips.order),
                          where: eq(clips.archived, false),
                        },
                      },
                    },
                  },
                },
              },
            })
          );

          return {
            ...repo,
            sections: versionSections,
          };
        }
      ),
      createRepoVersion: Effect.fn("createRepoVersion")(function* (input: {
        repoId: string;
        name: string;
      }) {
        const [version] = yield* makeDbCall(() =>
          db.insert(repoVersions).values(input).returning()
        );

        if (!version) {
          return yield* new UnknownDBServiceError({
            cause: "No version was returned from the database",
          });
        }

        return version;
      }),
      updateRepoVersionName: Effect.fn("updateRepoVersionName")(function* (opts: {
        versionId: string;
        name: string;
      }) {
        const { versionId, name } = opts;
        const [updated] = yield* makeDbCall(() =>
          db
            .update(repoVersions)
            .set({ name })
            .where(eq(repoVersions.id, versionId))
            .returning()
        );

        if (!updated) {
          return yield* new NotFoundError({
            type: "updateRepoVersionName",
            params: { versionId },
          });
        }

        return updated;
      }),
      updateRepoName: Effect.fn("updateRepoName")(function* (opts: {
        repoId: string;
        name: string;
      }) {
        const { repoId, name } = opts;
        const [updated] = yield* makeDbCall(() =>
          db
            .update(repos)
            .set({ name })
            .where(eq(repos.id, repoId))
            .returning()
        );

        if (!updated) {
          return yield* new NotFoundError({
            type: "updateRepoName",
            params: { repoId },
          });
        }

        return updated;
      }),
      updateRepoFilePath: Effect.fn("updateRepoFilePath")(function* (opts: {
        repoId: string;
        filePath: string;
      }) {
        const { repoId, filePath } = opts;

        // Check if multiple repos share the current repo's path
        const currentRepo = yield* makeDbCall(() =>
          db.query.repos.findFirst({
            where: eq(repos.id, repoId),
          })
        );

        if (!currentRepo) {
          return yield* new NotFoundError({
            type: "updateRepoFilePath",
            params: { repoId },
          });
        }

        const reposWithSamePath = yield* makeDbCall(() =>
          db.query.repos.findMany({
            where: eq(repos.filePath, currentRepo.filePath),
          })
        );

        if (reposWithSamePath.length > 1) {
          return yield* new AmbiguousRepoUpdateError({
            filePath: currentRepo.filePath,
            repoCount: reposWithSamePath.length,
          });
        }

        const [updated] = yield* makeDbCall(() =>
          db
            .update(repos)
            .set({ filePath })
            .where(eq(repos.id, repoId))
            .returning()
        );

        if (!updated) {
          return yield* new NotFoundError({
            type: "updateRepoFilePath",
            params: { repoId },
          });
        }

        return updated;
      }),
      deleteRepo: Effect.fn("deleteRepo")(function* (repoId: string) {
        yield* makeDbCall(() => db.delete(repos).where(eq(repos.id, repoId)));
      }),
      /**
       * Delete a repo version. Only the latest version can be deleted,
       * and a repo must have at least one version remaining.
       */
      deleteRepoVersion: Effect.fn("deleteRepoVersion")(function* (
        versionId: string
      ) {
        // Get the version to find its repoId
        const version = yield* makeDbCall(() =>
          db.query.repoVersions.findFirst({
            where: eq(repoVersions.id, versionId),
          })
        );

        if (!version) {
          return yield* new NotFoundError({
            type: "deleteRepoVersion",
            params: { versionId },
          });
        }

        // Get all versions for this repo
        const allVersions = yield* makeDbCall(() =>
          db.query.repoVersions.findMany({
            where: eq(repoVersions.repoId, version.repoId),
            orderBy: desc(repoVersions.createdAt),
          })
        );

        // Cannot delete the only version
        if (allVersions.length <= 1) {
          return yield* new CannotDeleteOnlyVersionError({
            versionId,
            repoId: version.repoId,
          });
        }

        // Can only delete the latest version
        const latestVersion = allVersions[0];
        if (!latestVersion || latestVersion.id !== versionId) {
          return yield* new CannotDeleteNonLatestVersionError({
            versionId,
            latestVersionId: latestVersion?.id ?? "none",
          });
        }

        // Delete the version (cascades to sections, lessons, videos, clips)
        yield* makeDbCall(() =>
          db.delete(repoVersions).where(eq(repoVersions.id, versionId))
        );

        // Return the new latest version (second in the original list)
        const newLatestVersion = allVersions[1];
        return newLatestVersion;
      }),
      /**
       * Copy structure from an existing version to a new version.
       * Copies all sections, lessons, videos, and non-archived clips.
       * Sets previousVersionSectionId and previousVersionLessonId for change tracking.
       */
      copyVersionStructure: Effect.fn("copyVersionStructure")(function* (input: {
        sourceVersionId: string;
        repoId: string;
        newVersionName: string;
      }) {
        // Verify sourceVersionId is the latest version for this repo
        const latestVersion = yield* makeDbCall(() =>
          db.query.repoVersions.findFirst({
            where: eq(repoVersions.repoId, input.repoId),
            orderBy: desc(repoVersions.createdAt),
          })
        );

        if (!latestVersion || latestVersion.id !== input.sourceVersionId) {
          return yield* new NotLatestVersionError({
            sourceVersionId: input.sourceVersionId,
            latestVersionId: latestVersion?.id ?? "none",
          });
        }

        // Create the new version
        const newVersion = yield* makeDbCall(() =>
          db.insert(repoVersions).values({
            repoId: input.repoId,
            name: input.newVersionName,
          }).returning()
        ).pipe(Effect.andThen((arr) => {
          const v = arr[0];
          if (!v) {
            return Effect.fail(new UnknownDBServiceError({ cause: "No version returned" }));
          }
          return Effect.succeed(v);
        }));

        // Get all sections for the source version with their lessons, videos, and clips
        const sourceSections = yield* makeDbCall(() =>
          db.query.sections.findMany({
            where: eq(sections.repoVersionId, input.sourceVersionId),
            orderBy: asc(sections.order),
            with: {
              lessons: {
                orderBy: asc(lessons.order),
                with: {
                  videos: {
                    orderBy: asc(videos.path),
                    with: {
                      clips: {
                        orderBy: asc(clips.order),
                        where: eq(clips.archived, false), // Only non-archived clips
                      },
                    },
                  },
                },
              },
            },
          })
        );

        // Track video ID mappings: sourceVideoId -> newVideoId
        const videoIdMappings: Array<{ sourceVideoId: string; newVideoId: string }> = [];

        // Copy each section
        for (const sourceSection of sourceSections) {
          const [newSection] = yield* makeDbCall(() =>
            db.insert(sections).values({
              repoId: input.repoId,
              repoVersionId: newVersion.id,
              previousVersionSectionId: sourceSection.id,
              path: sourceSection.path,
              order: sourceSection.order,
            }).returning()
          );

          if (!newSection) continue;

          // Copy each lesson in the section
          for (const sourceLesson of sourceSection.lessons) {
            const [newLesson] = yield* makeDbCall(() =>
              db.insert(lessons).values({
                sectionId: newSection.id,
                previousVersionLessonId: sourceLesson.id,
                path: sourceLesson.path,
                order: sourceLesson.order,
              }).returning()
            );

            if (!newLesson) continue;

            // Copy each video in the lesson
            for (const sourceVideo of sourceLesson.videos) {
              const [newVideo] = yield* makeDbCall(() =>
                db.insert(videos).values({
                  lessonId: newLesson.id,
                  path: sourceVideo.path,
                  originalFootagePath: sourceVideo.originalFootagePath,
                }).returning()
              );

              if (!newVideo) continue;

              // Track the video ID mapping
              videoIdMappings.push({
                sourceVideoId: sourceVideo.id,
                newVideoId: newVideo.id,
              });

              // Copy each non-archived clip in the video
              if (sourceVideo.clips.length > 0) {
                yield* makeDbCall(() =>
                  db.insert(clips).values(
                    sourceVideo.clips.map((clip) => ({
                      videoId: newVideo.id,
                      videoFilename: clip.videoFilename,
                      sourceStartTime: clip.sourceStartTime,
                      sourceEndTime: clip.sourceEndTime,
                      order: clip.order,
                      archived: false,
                      text: clip.text,
                      transcribedAt: clip.transcribedAt,
                      scene: clip.scene,
                      profile: clip.profile,
                      beatType: clip.beatType,
                    }))
                  )
                );
              }
            }
          }
        }

        return { version: newVersion, videoIdMappings };
      }),
      /**
       * Get all video IDs for a specific version.
       */
      getVideoIdsForVersion: Effect.fn("getVideoIdsForVersion")(function* (
        versionId: string
      ) {
        const versionSections = yield* makeDbCall(() =>
          db.query.sections.findMany({
            where: eq(sections.repoVersionId, versionId),
            with: {
              lessons: {
                with: {
                  videos: {
                    columns: {
                      id: true,
                    },
                  },
                },
              },
            },
          })
        );

        const videoIds: string[] = [];
        for (const section of versionSections) {
          for (const lesson of section.lessons) {
            for (const video of lesson.videos) {
              videoIds.push(video.id);
            }
          }
        }

        return videoIds;
      }),
      /**
       * Get all versions for a repo with their full structure for changelog generation.
       * Returns versions in reverse chronological order (newest first).
       */
      getAllVersionsWithStructure: Effect.fn("getAllVersionsWithStructure")(
        function* (repoId: string) {
          const versions = yield* makeDbCall(() =>
            db.query.repoVersions.findMany({
              where: eq(repoVersions.repoId, repoId),
              orderBy: desc(repoVersions.createdAt),
            })
          );

          const versionsWithStructure: Array<{
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
          }> = [];

          for (const version of versions) {
            const versionSections = yield* makeDbCall(() =>
              db.query.sections.findMany({
                where: eq(sections.repoVersionId, version.id),
                orderBy: asc(sections.order),
                with: {
                  lessons: {
                    orderBy: asc(lessons.order),
                    with: {
                      videos: {
                        orderBy: asc(videos.path),
                        with: {
                          clips: {
                            orderBy: asc(clips.order),
                            where: eq(clips.archived, false),
                          },
                        },
                      },
                    },
                  },
                },
              })
            );

            versionsWithStructure.push({
              id: version.id,
              name: version.name,
              createdAt: version.createdAt,
              sections: versionSections.map((s) => ({
                id: s.id,
                path: s.path,
                previousVersionSectionId: s.previousVersionSectionId,
                lessons: s.lessons.map((l) => ({
                  id: l.id,
                  path: l.path,
                  previousVersionLessonId: l.previousVersionLessonId,
                  videos: l.videos.map((v) => ({
                    id: v.id,
                    path: v.path,
                    clips: v.clips.map((c) => ({
                      id: c.id,
                      text: c.text,
                    })),
                  })),
                })),
              })),
            });
          }

          return versionsWithStructure;
        }
      ),
    };
  }),
}) {}
