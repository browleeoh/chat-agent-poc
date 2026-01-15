import { Button } from "@/components/ui/button";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { Console, Effect } from "effect";
import { ArchiveRestore } from "lucide-react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/archived-repos";

export const meta: Route.MetaFunction = () => {
  return [
    {
      title: "CVM - Archived Repos",
    },
  ];
};

export const loader = async (_args: Route.LoaderArgs) => {
  return Effect.gen(function* () {
    const db = yield* DBService;
    const archivedRepos = yield* db.getArchivedRepos();

    return {
      archivedRepos,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};

export default function ArchivedRepos(props: Route.ComponentProps) {
  const unarchiveRepoFetcher = useFetcher();
  const data = props.loaderData;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Archived Repos</h1>

      {data.archivedRepos.length === 0 ? (
        <p className="text-muted-foreground">No archived repos.</p>
      ) : (
        <div className="space-y-2">
          {data.archivedRepos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-medium">{repo.name}</h3>
                <p className="text-sm text-muted-foreground">{repo.filePath}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  unarchiveRepoFetcher.submit(
                    { archived: "false" },
                    {
                      method: "post",
                      action: `/api/repos/${repo.id}/archive`,
                    }
                  );
                }}
                disabled={unarchiveRepoFetcher.state !== "idle"}
              >
                <ArchiveRestore className="w-4 h-4 mr-2" />
                Unarchive
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
