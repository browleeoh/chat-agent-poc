import type { Route } from "./+types/api.repos.add";
import { Effect, Schema } from "effect";

const addRepoSchema = Schema.Struct({
  repoPath: Schema.String,
});

export const action = async ({ request }: Route.ActionArgs) => {
  const json = await request.json();

  return await Effect.gen(function* () {
    const result = yield* Schema.decode(addRepoSchema)(json);
  }).pipe(
    Effect.catchTag("ParseError", (e) => {
      console.error(e);
      return Effect.succeed(new Response("Invalid request", { status: 400 }));
    }),
    Effect.ensureErrorType<never>(),
    Effect.runPromise
  );
};
