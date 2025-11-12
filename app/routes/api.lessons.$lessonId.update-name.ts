import { Data, Effect, Schema } from "effect";
import type { Route } from "./+types/api.lessons.$lessonId.update-name";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { withDatabaseDump } from "@/services/dump-service";

const updateLessonNameSchema = Schema.Struct({
  path: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Lesson name cannot be empty" }),
    Schema.filter(
      (s) => {
        // Basic validation: no filesystem-unsafe characters
        const invalidChars = /[<>:"|?*\x00-\x1F]/;
        return !invalidChars.test(s);
      },
      { message: () => "Lesson name contains invalid characters" }
    )
  ),
});

class InvalidOrderError extends Data.TaggedError("InvalidOrderError")<{
  message: string;
}> {}

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const { path } = yield* Schema.decodeUnknown(updateLessonNameSchema)(
      formDataObject
    );

    const db = yield* DBService;

    const order = Number(path.split("-")[0]);

    if (isNaN(order)) {
      return yield* new InvalidOrderError({
        message: "String does not contain a valid order",
      });
    }

    // Fetch current lesson to preserve sectionId and order
    const currentLesson = yield* db.getLessonById(args.params.lessonId);

    yield* db.updateLesson(args.params.lessonId, {
      path: path.trim(),
      sectionId: currentLesson.sectionId,
      lessonNumber: order,
    });

    return { success: true };
  }).pipe(withDatabaseDump, Effect.provide(layerLive), Effect.runPromise);
};
