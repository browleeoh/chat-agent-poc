import { Tiktoken } from "js-tiktoken/lite";
import ranks from "js-tiktoken/ranks/o200k_base";
import { cn } from "@/lib/utils";

const tiktoken = new Tiktoken(ranks);

const MAX_EMBEDDING_VALUE = 5;

// Seeded random number generator (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple string hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash >>> 0; // Ensure positive integer
}

export function getSeededRandomIntegers(
  seed: number,
  length: number,
  max: number = MAX_EMBEDDING_VALUE
): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length }, () => Math.floor(rng() * (max + 1)));
}

export function getSeededRandomIntegersFromString(
  seed: string,
  length: number,
  max: number = MAX_EMBEDDING_VALUE
): number[] {
  return getSeededRandomIntegers(hashString(seed), length, max);
}

export const TokenWrapper = (props: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "border-gray-500 rounded-lg border-3 text-sm flex text-gray-200 overflow-hidden",
        props.className
      )}
    >
      {props.children}
    </div>
  );
};

export const TokenDivider = () => {
  return <div className="border-gray-500 border-l-3 h-full"></div>;
};

export const Embedding = (props: {
  seed: string;
  count: number;
  className?: string;
  color?: Color;
}) => {
  const integers = getSeededRandomIntegersFromString(
    props.seed,
    props.count,
    MAX_EMBEDDING_VALUE
  );

  const width = 100 / props.count;

  const color = props.color || "gray";

  const integerToColor: Record<Color, Record<number, string>> = {
    blue: {
      0: "bg-blue-600",
      1: "bg-blue-400",
      2: "bg-blue-300",
    },
    green: {
      0: "bg-green-600",
      1: "bg-green-400",
      2: "bg-green-300",
    },
    red: {
      0: "bg-red-600",
      1: "bg-red-400",
      2: "bg-red-300",
    },
    orange: {
      0: "bg-orange-600",
      1: "bg-orange-400",
      2: "bg-orange-300",
    },
    gray: {
      0: "bg-gray-600",
      1: "bg-gray-400",
      2: "bg-gray-300",
    },
  };

  return (
    <div
      className={cn("flex overflow-hidden relative w-full", props.className)}
    >
      {integers.map((integer, index) => (
        <div
          key={index}
          className={integerToColor[color][integer]}
          style={{
            width: `${width}%`,
            height: "100%",
          }}
        ></div>
      ))}
    </div>
  );
};

export const Token = (props: { children: string }) => {
  const tokens = tiktoken.encode(props.children);

  return (
    <TokenWrapper>
      <div className="p-1 px-6">{tokens[0]}</div>
      <TokenDivider />
      <div className="p-1 px-6">{props.children}</div>
    </TokenWrapper>
  );
};

export const TokenWithEmbedding = (props: { children: string }) => {
  const tokens = tiktoken.encode(props.children);

  return (
    <TokenWrapper>
      <div className="p-1 px-6">{tokens[0]}</div>
      <TokenDivider />
      <div className="p-1 px-6">{props.children}</div>
      <TokenDivider />
      <Embedding seed={props.children} count={10} className="w-16" />
    </TokenWrapper>
  );
};

export const TokenWithPositionalEmbedding = (props: {
  children: string;
  position: number;
}) => {
  return (
    <TokenWrapper>
      <div className="p-1 px-6">{props.position}</div>
      <TokenDivider />
      <div className="p-1 px-6">{props.children}</div>
      <TokenDivider />
      <Embedding
        seed={props.children + props.position}
        count={10}
        className="w-16"
      />
    </TokenWrapper>
  );
};

export const TokenGroup = (props: { children: React.ReactNode }) => {
  return <div className="flex flex-wrap gap-3 ">{props.children}</div>;
};

export const Wrapper = (props: { children: React.ReactNode }) => {
  return (
    <div className="max-w-lg font-tldraw my-24 font-semibold space-y-8 text-white mx-24">
      {props.children}
    </div>
  );
};

export const TitleAndDescription = (props: {
  title: string;
  description: string;
  titleClassName?: string;
}) => {
  return (
    <div>
      <h2 className={cn("text-4xl font-bold mb-2", props.titleClassName)}>
        {props.title}
      </h2>
      <p className="text-gray-300/90 font-medium">{props.description}</p>
    </div>
  );
};

const borderColorMap = {
  blue: "border-blue-400",
  green: "border-green-600",
  red: "border-red-500",
  orange: "border-orange-500",
  gray: "border-gray-300",
};

const backgroundColorMap = {
  blue: "bg-blue-400",
  green: "bg-green-600",
  red: "bg-red-500",
  orange: "bg-orange-500",
  gray: "bg-gray-300",
};

type Color = keyof typeof borderColorMap;

export const Ring = (props: { color: Color; children?: React.ReactNode }) => {
  return (
    <div
      className={`size-8 rounded-full border-5 ${
        borderColorMap[props.color]
      } flex items-center justify-center shrink-0`}
    >
      {props.children}
    </div>
  );
};

export const RingWithScore = (props: { color: Color; score: string }) => {
  return (
    <div
      className={`size-8 rounded-full border-4 ${
        borderColorMap[props.color]
      } flex items-center justify-center shrink-0`}
    >
      <span className="text-xs font-bold">{props.score}</span>
    </div>
  );
};

type ArrowListStep = {
  title: string;
  description?: string;
  ring: React.ReactNode;
  children?: React.ReactNode;
};

const DOCUMENT_START_WIDTH = 30;

export const Document = (props: {
  count: number;
  seed: string;
  color?: Color;
  className?: string;
}) => {
  const widths = getSeededRandomIntegersFromString(
    props.seed,
    props.count,
    100 - DOCUMENT_START_WIDTH
  );

  const color = props.color || "gray";

  return (
    <div className={cn("", props.className)}>
      {widths.map((width, index) => (
        <div
          key={index}
          className={`h-1 rounded-full mb-2 ${backgroundColorMap[color]}`}
          style={{ width: `${DOCUMENT_START_WIDTH + width}%` }}
        ></div>
      ))}
    </div>
  );
};

export const DocumentWithHighlights = (props: {
  count: number;
  seed: string;
  color?: Color;
  className?: string;
  highlightIndices: number[];
}) => {
  const widths = getSeededRandomIntegersFromString(
    props.seed,
    props.count,
    100 - DOCUMENT_START_WIDTH
  );

  const color = props.color || "gray";

  return (
    <div className={cn("", props.className)}>
      {widths.map((width, index) => {
        const lineWidth = DOCUMENT_START_WIDTH + width;
        const wordCount = Math.floor(lineWidth / 15); // Approximate words per line
        const wordWidths = getSeededRandomIntegers(
          hashString(props.seed + index),
          wordCount,
          15
        );

        return (
          <div key={index} className="relative mb-2 flex gap-1.5">
            {wordWidths.map((wordWidth, wordIndex) => {
              const isHighlighted =
                props.highlightIndices.includes(index) && wordIndex % 3 === 1;
              return (
                <div
                  key={wordIndex}
                  className={`h-1.5 rounded-full ${
                    isHighlighted ? "bg-gray-300" : "bg-gray-600"
                  }`}
                  style={{ width: `${16 + wordWidth * 2}px` }}
                ></div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const IDFGraph = (props: { className?: string }) => {
  return (
    <div className={cn("relative", props.className)}>
      {/* Graph area */}
      <div className="border-l-3 border-b-3 border-gray-400 h-24 w-full relative">
        {/* Curve - going from bottom-left to top-right with a curve */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 0,100 Q 30,60 50,30 T 100,3"
            stroke="#d1d5db"
            strokeWidth="3"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {/* X-axis label */}
      <div className="text-xs text-gray-400 text-center mt-1">Term Rarity</div>
    </div>
  );
};

export const LengthNormalization = (props: { className?: string }) => {
  return (
    <div className={cn("flex items-center gap-6", props.className)}>
      {/* Three bars of different lengths */}
      <div className="space-y-2 flex-1">
        <div className="h-2 bg-gray-600 rounded-full w-full"></div>
        <div className="h-2 bg-gray-400 rounded-full w-2/3"></div>
        <div className="h-2 bg-gray-300 rounded-full w-5/6"></div>
      </div>
      {/* Arrow */}
      <div className="text-gray-300 text-5xl">→</div>
      {/* Three bars of equal length */}
      <div className="space-y-2 flex-1">
        <div className="h-2 bg-gray-600 rounded-full w-4/5"></div>
        <div className="h-2 bg-gray-400 rounded-full w-4/5"></div>
        <div className="h-2 bg-gray-300 rounded-full w-4/5"></div>
      </div>
    </div>
  );
};

export const ArrowList = (props: { steps: ArrowListStep[] }) => {
  return (
    <div className="space-y-4">
      {props.steps.map((step, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            {step.ring}
            {index < props.steps.length - 1 && (
              <div className="flex flex-col items-center flex-1 mt-4">
                <div className="w-0.75 bg-gray-300 flex-1 rounded-full relative">
                  {/* Arrow heads */}
                  <div className="absolute bottom-0 rotate-30 left-[3px] w-[3px] h-3 bg-gray-300 rounded-full"></div>
                  <div className="absolute bottom-0 rotate-150 right-[3px] w-[3px] h-3 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 pb-10">
            <h3 className="text-xl font-bold mb-1 text-gray-200">
              {step.title}
            </h3>
            {step.description && (
              <p className="text-gray-300/90 text-sm font-medium">
                {step.description}
              </p>
            )}
            {step.children && <div className="mt-4">{step.children}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
