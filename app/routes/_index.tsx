"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Play, Trash2, VideoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Video {
  id: string;
  type: "problem" | "solution";
  title: string;
}

interface Lesson {
  id: string;
  title: string;
  videos: Video[];
}

interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Repository {
  id: string;
  name: string;
  sections: Section[];
}

export default function Component() {
  const [selectedRepo, setSelectedRepo] = useState("ai-typescript-toolkit");
  const [isAddRepoModalOpen, setIsAddRepoModalOpen] = useState(false);
  const [newRepoPath, setNewRepoPath] = useState("");

  // Generate sample data
  const repositories: Repository[] = [
    {
      id: "ai-typescript-toolkit",
      name: "ai-typescript-toolkit",
      sections: Array.from({ length: 5 }, (_, sectionIndex) => ({
        id: `section-${sectionIndex + 1}`,
        title: `${String(sectionIndex + 1).padStart(3, "0")}-section-${
          sectionIndex + 1
        }`,
        lessons: Array.from({ length: 3 }, (_, lessonIndex) => ({
          id: `lesson-${sectionIndex + 1}-${lessonIndex + 1}`,
          title: `${String(sectionIndex + 1).padStart(3, "0")}-lesson-${
            lessonIndex + 1
          }`,
          videos: [
            {
              id: `problem-${sectionIndex + 1}-${lessonIndex + 1}`,
              type: "problem",
              title: "Problem Video",
            },
            {
              id: `solution-${sectionIndex + 1}-${lessonIndex + 1}`,
              type: "solution",
              title: "Solution Video",
            },
          ],
        })),
      })),
    },
    {
      id: "some-other-repo",
      name: "some-other-repo",
      sections: [],
    },
  ];

  const handleAddRepo = () => {
    if (newRepoPath.trim()) {
      // Here you would typically add the repo to your repositories array
      console.log("Adding repo from path:", newRepoPath);
      setNewRepoPath("");
      setIsAddRepoModalOpen(false);
    }
  };

  const currentRepo = repositories.find((repo) => repo.id === selectedRepo);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Repos */}
      <div className="w-80 border-r bg-muted/30">
        <div className="p-4 pb-0">
          <h2 className="text-lg font-semibold mb-4">Repos</h2>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-2">
              {repositories.map((repo) => (
                <Button
                  key={repo.id}
                  variant={selectedRepo === repo.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedRepo(repo.id)}
                >
                  {repo.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
          <Separator className="mb-4 -mt-4" />
          <Dialog
            open={isAddRepoModalOpen}
            onOpenChange={setIsAddRepoModalOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full bg-transparent">
                <Plus className="w-4 h-4 mr-2" />
                Add Repo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Repository</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="repo-path">Repository File Path</Label>
                  <Input
                    id="repo-path"
                    placeholder="Enter local file path..."
                    value={newRepoPath}
                    onChange={(e) => setNewRepoPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddRepo();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddRepoModalOpen(false);
                      setNewRepoPath("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRepo}
                    disabled={!newRepoPath.trim()}
                  >
                    Add Repository
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">{currentRepo?.name}</h1>

          <div className="space-y-8">
            {currentRepo?.sections.map((section) => (
              <Card key={section.id} className="border-0 shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {section.lessons.map((lesson) => (
                    <div key={lesson.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{lesson.title}</h3>
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add from OBS
                        </Button>
                      </div>

                      <div className="space-y-2 ml-4">
                        {lesson.videos.map((video) => (
                          <div
                            key={video.id}
                            className="flex items-center justify-between p-3 bg-muted/10 rounded-md"
                          >
                            <div className="flex items-center gap-2">
                              <VideoIcon />
                              <span className="font-medium">{video.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Play className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
