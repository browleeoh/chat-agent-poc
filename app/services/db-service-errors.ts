import { Data } from "effect";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  type: string;
  params: object;
  message?: string;
}> {}

export class UnknownDBServiceError extends Data.TaggedError("UnknownDBServiceError")<{
  cause: unknown;
}> {}

export class NotLatestVersionError extends Data.TaggedError("NotLatestVersionError")<{
  sourceVersionId: string;
  latestVersionId: string;
}> {}

export class CannotDeleteOnlyVersionError extends Data.TaggedError(
  "CannotDeleteOnlyVersionError"
)<{
  versionId: string;
  repoId: string;
}> {}

export class CannotDeleteNonLatestVersionError extends Data.TaggedError(
  "CannotDeleteNonLatestVersionError"
)<{
  versionId: string;
  latestVersionId: string;
}> {}

export class AmbiguousRepoUpdateError extends Data.TaggedError(
  "AmbiguousRepoUpdateError"
)<{
  filePath: string;
  repoCount: number;
}> {}

export class CannotArchiveLessonVideoError extends Data.TaggedError(
  "CannotArchiveLessonVideoError"
)<{
  videoId: string;
  lessonId: string;
}> {}
