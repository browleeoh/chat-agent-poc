import { Effect, Schema } from "effect";
import type { Route } from "./+types/api.lessons.delete";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";

const deleteLessonSchema = Schema.Struct({
  lessonId: Schema.String,
});

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const { lessonId } = yield* Schema.decodeUnknown(deleteLessonSchema)(
      formDataObject
    );

    const db = yield* DBService;

    yield* db.deleteLesson(lessonId);

    return { success: true };
  }).pipe(Effect.provide(layerLive), Effect.runPromise);
};
