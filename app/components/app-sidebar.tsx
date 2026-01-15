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
import { cn } from "@/lib/utils";
import {
  Archive,
  ChevronRight,
  FolderGit2,
  LayoutTemplate,
  Plus,
  VideoIcon,
} from "lucide-react";
import { Link, useFetcher, useNavigate } from "react-router";

export interface AppSidebarProps {
  repos: Array<{
    id: string;
    name: string;
  }>;
  standaloneVideos: Array<{
    id: string;
    path: string;
  }>;
  selectedRepoId: string | null;
  isAddRepoModalOpen: boolean;
  setIsAddRepoModalOpen: (open: boolean) => void;
  isAddStandaloneVideoModalOpen: boolean;
  setIsAddStandaloneVideoModalOpen: (open: boolean) => void;
}

export function AppSidebar({
  repos,
  standaloneVideos,
  selectedRepoId,
  isAddRepoModalOpen,
  setIsAddRepoModalOpen,
  isAddStandaloneVideoModalOpen,
  setIsAddStandaloneVideoModalOpen,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const archiveRepoFetcher = useFetcher();
  const archiveVideoFetcher = useFetcher();

  return (
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
                {repos.map((repo) => (
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
                    Archived Repos
                  </Button>
                </Link>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Videos */}
          <Collapsible defaultOpen>
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
                {standaloneVideos.map((video) => (
                  <ContextMenu key={video.id}>
                    <ContextMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start whitespace-normal text-left h-auto py-1.5"
                        asChild
                      >
                        <Link to={`/videos/${video.id}/edit`}>{video.path}</Link>
                      </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onSelect={() => {
                          archiveVideoFetcher.submit(
                            { archived: "true" },
                            {
                              method: "post",
                              action: `/api/videos/${video.id}/archive`,
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
  );
}
