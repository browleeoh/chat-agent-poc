import { Layer } from "effect";
import { RepoParserService } from "./repo-parser";
import { DBService } from "./db-service";
import { NodeFileSystem } from "@effect/platform-node";

export const layerLive = Layer.mergeAll(
  RepoParserService.Default,
  DBService.Default,
  NodeFileSystem.layer
);
