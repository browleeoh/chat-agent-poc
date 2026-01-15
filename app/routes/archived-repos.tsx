import { AddRepoModal } from "@/components/add-repo-modal";
import { AddStandaloneVideoModal } from "@/components/add-standalone-video-modal";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { Console, Effect } from "effect";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  FolderGit2,
  LayoutTemplate,
  Plus,
  VideoIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useFetcher, useNavigate, useSearchParams } from "react-router";
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
    const repos = yield* db.getRepos();
    const standaloneVideos = yield* db.getStandaloneVideos();

    return {
      archivedRepos,
      repos,
      standaloneVideos,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};

export default function ArchivedRepos(props: Route.ComponentProps) {
  const unarchiveRepoFetcher = useFetcher();
  const archiveRepoFetcher = useFetcher();
  const data = props.loaderData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedRepoId = searchParams.get("repoId");
  const [isAddRepoModalOpen, setIsAddRepoModalOpen] = useState(false);
  const [isAddStandaloneVideoModalOpen, setIsAddStandaloneVideoModalOpen] =
    useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Sidebar */}
      <div className="w-80 border-r bg-muted/30 hidden lg:flex flex-col">
        <div className="p-4 flex-1 flex flex-col min-h-0">
          <div className="space-y-2 flex-1 overflow-y-auto">
            {/* Repos */}
            <Collapsible defaultOpen>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold hover:text-foreground/80 transition-colors group">
                  <ChevronRight className="w-4 h-4 transition-transform group-data-[state=open]:rotate-90" />
                  <FolderGit2 className="w-5 h-5" />
                  Repos
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsAddRepoModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <CollapsibleContent>
                <div className="ml-6 mt-2 space-y-1">
                  {data.repos.map((repo) => (
                    <ContextMenu key={repo.id}>
                      <ContextMenuTrigger asChild>
                        <Button
                          variant={selectedRepoId === repo.id ? "default" : "ghost"}
                          size="sm"
                          className={cn(
                            "w-full justify-start whitespace-normal text-left h-auto py-1.5",
                            selectedRepoId === repo.id &&
                              "bg-muted text-foreground/90 hover:bg-muted/90"
                          )}
                          onClick={() => {
                            navigate(`/?repoId=${repo.id}`, {
                              preventScrollReset: true,
                            });
                          }}
                        >
                          {repo.name}
                        </Button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onSelect={() => {
                            archiveRepoFetcher.submit(
                              { archived: "true" },
                              {
                                method: "post",
                                action: `/api/repos/${repo.id}/archive`,
                              }
                            );
                          }}
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}

                  {/* Archived Repos */}
                  <Link to="/archived-repos">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Archived Repos
                    </Button>
                  </Link>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Videos */}
            <Collapsible>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold hover:text-foreground/80 transition-colors group">
                  <ChevronRight className="w-4 h-4 transition-transform group-data-[state=open]:rotate-90" />
                  <VideoIcon className="w-5 h-5" />
                  Videos
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsAddStandaloneVideoModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <CollapsibleContent>
                <div className="ml-6 mt-2 space-y-1">
                  {data.standaloneVideos.map((video) => (
                    <Button
                      key={video.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start whitespace-normal text-left h-auto py-1.5"
                      asChild
                    >
                      <Link to={`/videos/${video.id}/edit`}>{video.path}</Link>
                    </Button>
                  ))}
                  <Link to="/videos">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                    >
                      View All Videos
                    </Button>
                  </Link>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Diagram Playground */}
            <Link
              to="/diagram-playground"
              className="flex items-center gap-2 text-lg font-semibold hover:text-foreground/80 transition-colors pl-6"
            >
              <LayoutTemplate className="w-5 h-5" />
              Diagram Playground
            </Link>
          </div>
          <Separator className="my-4" />
          <AddRepoModal
            isOpen={isAddRepoModalOpen}
            onOpenChange={setIsAddRepoModalOpen}
          />
          <AddStandaloneVideoModal
            open={isAddStandaloneVideoModalOpen}
            onOpenChange={setIsAddStandaloneVideoModalOpen}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
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
                    <p className="text-sm text-muted-foreground">
                      {repo.filePath}
                    </p>
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
      </div>
    </div>
  );
}
