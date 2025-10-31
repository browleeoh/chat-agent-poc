import {
  ArrowList,
  Document,
  DocumentWithHighlights,
  Embedding,
  IDFGraph,
  LengthNormalization,
  Ring,
  RingWithScore,
  TitleAndDescription,
  Token,
  TokenGroup,
  TokenWithEmbedding,
  TokenWithPositionalEmbedding,
  TokenWrapper,
  Wrapper,
} from "@/components/diagrams/diagram-components";
import type { Route } from "./+types/diagram-playground";
import { Trash2, Archive } from "lucide-react";

export default function DiagramPlayground(_props: Route.ComponentProps) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Diagram Playground</h1>
      <div className="flex flex-col-reverse">
        <Wrapper>
          <TitleAndDescription
            title="Why Chunk?"
            description="Chunking helps you make large documents searchable."
          />
          <ArrowList
            steps={[
              {
                title: "Long Documents",
                description:
                  "With lots of unrelated text are inefficient for LLM's to process.",
                ring: <Ring color="blue"></Ring>,
                children: (
                  <div className="flex gap-2">
                    <div className="w-1/3">
                      <Document count={3} seed="long-doc" className="" />
                      <Document count={5} seed="also-long" className="" />
                    </div>
                    <Document
                      count={4}
                      seed="another-long-doc"
                      className="w-1/3"
                    />
                  </div>
                ),
              },
              {
                title: "Chunking",
                description:
                  "takes the document and turns into into smaller chunks",
                ring: <Ring color="green"></Ring>,
                children: (
                  <div className="flex gap-2">
                    <Document
                      count={3}
                      seed="long-doc"
                      color="orange"
                      className="w-1/3"
                    />
                    <Document
                      count={5}
                      seed="also-long"
                      color="red"
                      className="w-1/3"
                    />
                    <Document
                      count={4}
                      seed="another-long-doc"
                      color="blue"
                      className="w-1/3"
                    />
                  </div>
                ),
              },
              {
                title: "Embedding",
                description: "allows each chunk to be searchable on its own",
                ring: <Ring color="orange"></Ring>,
                children: (
                  <div className="flex gap-4">
                    <TokenWrapper className="w-1/3">
                      <Embedding
                        seed="long-doc"
                        count={20}
                        className="h-8"
                        color="orange"
                      />
                    </TokenWrapper>
                    <TokenWrapper className="w-1/3">
                      <Embedding
                        seed="also-long"
                        count={20}
                        className="h-8"
                        color="red"
                      />
                    </TokenWrapper>
                    <TokenWrapper className="w-1/3">
                      <Embedding
                        seed="another-long-doc"
                        count={20}
                        className="h-8"
                        color="blue"
                      />
                    </TokenWrapper>
                  </div>
                ),
              },
            ]}
          ></ArrowList>
        </Wrapper>
        <Wrapper>
          <TitleAndDescription
            title="Creating Embeddings"
            description="Embeddings are an LLM's numeric representation for what a piece of text means."
          />
          <ArrowList
            steps={[
              {
                title: "Input Tokens",
                description: "The input text gets turned into tokens.",
                ring: <Ring color="blue"></Ring>,
                children: (
                  <TokenGroup>
                    <Token>My</Token>
                    <Token>favorite</Token>
                    <Token>color</Token>
                    <Token>is</Token>
                  </TokenGroup>
                ),
              },
              {
                title: "Token Embeddings",
                description:
                  "Grabs the meaning of the token from a lookup table (created during training)",
                ring: <Ring color="green"></Ring>,
                children: (
                  <TokenGroup>
                    <TokenWithEmbedding>My</TokenWithEmbedding>
                    <TokenWithEmbedding>favorite</TokenWithEmbedding>
                    <TokenWithEmbedding>color</TokenWithEmbedding>
                    <TokenWithEmbedding>is</TokenWithEmbedding>
                  </TokenGroup>
                ),
              },
              {
                title: "Positional Embeddings",
                description:
                  "Encodes the meaning of the word's position in the sequence",
                ring: <Ring color="red"></Ring>,
                children: (
                  <TokenGroup>
                    <TokenWithPositionalEmbedding position={0}>
                      My
                    </TokenWithPositionalEmbedding>
                    <TokenWithPositionalEmbedding position={1}>
                      favorite
                    </TokenWithPositionalEmbedding>
                    <TokenWithPositionalEmbedding position={2}>
                      color
                    </TokenWithPositionalEmbedding>
                    <TokenWithPositionalEmbedding position={3}>
                      is
                    </TokenWithPositionalEmbedding>
                  </TokenGroup>
                ),
              },
              {
                title: "Combined Embeddings",
                description:
                  "Combines the positional and token embeddings into a single embedding",
                ring: <Ring color="orange"></Ring>,
                children: (
                  <TokenWrapper>
                    <Embedding
                      seed="My favorite color is"
                      count={80}
                      className="w-full h-8"
                    />
                  </TokenWrapper>
                ),
              },
            ]}
          ></ArrowList>
        </Wrapper>
        <Wrapper>
          <TitleAndDescription
            title="Searching With Embeddings"
            description="You can use embeddings to compare how similar in 'meaning' two pieces of text are"
            titleClassName="text-3xl"
          />
          <ArrowList
            steps={[
              {
                title: "Search Text",
                description: '"Sun blocked by moon"',
                ring: <Ring color="blue"></Ring>,
                children: (
                  <TokenWrapper className="w-1/4">
                    <Embedding
                      seed="Sun blocked by moon"
                      count={20}
                      className="h-8"
                    />
                  </TokenWrapper>
                ),
              },
              {
                title: "Document",
                description: '"Total Solar Eclipse"',
                ring: <Ring color="blue"></Ring>,
                children: (
                  <TokenWrapper className="w-1/4">
                    <Embedding
                      seed="Total Solar Eclipse"
                      count={20}
                      className="h-8"
                    />
                  </TokenWrapper>
                ),
              },
              {
                title: "Cosine Similarity",
                description:
                  "Compares how close two embeddings are in 'vector space'",
                ring: <Ring color="green"></Ring>,
                children: (
                  <div className="flex items-center gap-4">
                    <TokenWrapper className="w-1/4">
                      <Embedding
                        seed="Sun blocked by moon"
                        count={20}
                        className="h-8"
                      />
                    </TokenWrapper>
                    <span className="text-2xl">+</span>
                    <TokenWrapper className="w-1/4">
                      <Embedding
                        seed="Total Solar Eclipse"
                        count={20}
                        className="h-8"
                      />
                    </TokenWrapper>
                    <span className="text-2xl">=</span>
                    <RingWithScore color="gray" score="0.9" />
                  </div>
                ),
              },
              {
                title: "Final Score",
                description: "Higher is better",
                ring: <RingWithScore color="red" score="0.9" />,
                children: null,
              },
            ]}
          ></ArrowList>
        </Wrapper>
        <Wrapper>
          <TitleAndDescription
            title="How Does BM25 Work?"
            description="BM25 is a scoring function that ranks documents based on how relevant they are to the keywords."
            titleClassName="text-3xl"
          />
          <ArrowList
            steps={[
              {
                title: "Search Terms",
                description: "Keywords to find in documents",
                ring: <Ring color="gray"></Ring>,
                children: (
                  <div className="flex gap-3">
                    <TokenWrapper className="px-6 py-1">machine</TokenWrapper>
                    <TokenWrapper className="px-6 py-1">learning</TokenWrapper>
                  </div>
                ),
              },
              {
                title: "Term Frequency",
                description: "How often keywords appear in the document",
                ring: <Ring color="blue"></Ring>,
                children: (
                  <DocumentWithHighlights
                    count={8}
                    seed="bm25-doc"
                    color="gray"
                    highlightIndices={[1, 3, 5]}
                  />
                ),
              },
              {
                title: "IDF",
                description: "Rare terms score higher across corpus",
                ring: <Ring color="orange"></Ring>,
                children: <IDFGraph className="w-2/3" />,
              },
              {
                title: "Length Normalization",
                description: "Prevents longer documents dominating",
                ring: <Ring color="green"></Ring>,
                children: <LengthNormalization />,
              },
              {
                title: "Final Score",
                description: "Higher is better",
                ring: <RingWithScore color="red" score="10" />,
                children: null,
              },
            ]}
          ></ArrowList>
        </Wrapper>
        <Wrapper>
          <TitleAndDescription
            title="Multi-Phase Plans"
            description="Building large features with AI isn't possible without breaking them into phases"
            titleClassName="text-3xl"
          />
          <ArrowList
            steps={[
              {
                title: "Initial Feature Idea",
                description:
                  "A disorganized description of the feature, via voice dictation",
                ring: <Ring color="blue"></Ring>,
                children: <Document count={4} seed="feature-idea" />,
              },
              {
                title: "Ask For Multi-Phase Plan",
                description:
                  "Use plan mode to break down the feature into phases",
                ring: <Ring color="green"></Ring>,
                children: (
                  <div className="space-y-2 text-xs">
                    <div className="border-l-4 border-gray-400 pl-3 py-1 text-gray-300">
                      Phase 1: Setup auth infrastructure
                    </div>
                    <div className="border-l-4 border-gray-400 pl-3 py-1 text-gray-300">
                      Phase 2: Implement OAuth providers
                    </div>
                    <div className="border-l-4 border-gray-400 pl-3 py-1 text-gray-300">
                      Phase 3: JWT token management
                    </div>
                  </div>
                ),
              },
              {
                title: "Execute Phase By Phase",
                ring: <Ring color="orange"></Ring>,
                children: (
                  <div className="space-y-2 text-xs">
                    <div className="border-l-4 border-green-500 pl-3 py-1 text-gray-300 bg-green-900/20">
                      ✓ Phase 1: Complete
                    </div>
                    <div className="border-l-4 border-gray-200 pl-3 py-1 text-gray-200 bg-gray-700/40">
                      → Phase 2: In progress
                    </div>
                    <div className="border-l-4 border-gray-600 pl-3 py-1 text-gray-500">
                      Phase 3: Pending
                    </div>
                  </div>
                ),
              },
              {
                title: "Monitor Context Window",
                ring: <Ring color="red"></Ring>,
                children: (
                  <div className="">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400"
                        style={{ width: "72.5%" }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-300">
                        Context: 145k / 200k tokens
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                title: "Clear or Compact When Needed",
                description:
                  "If context fills up too much, remove the cruft before continuing",
                ring: <Ring color="gray"></Ring>,
                children: (
                  <div className="flex gap-3 items-center">
                    <div className="rounded-lg px-4 py-2 text-sm bg-gray-300 text-gray-900 flex items-center gap-2">
                      <Trash2 size={16} />
                      clear
                    </div>
                    <span className="text-gray-200 text-xl">or</span>
                    <div className="rounded-lg px-4 py-2 text-sm bg-gray-300 text-gray-900 flex items-center gap-2">
                      <Archive size={16} />
                      compact
                    </div>
                  </div>
                ),
              },
            ]}
          ></ArrowList>
        </Wrapper>
      </div>
    </div>
  );
}
