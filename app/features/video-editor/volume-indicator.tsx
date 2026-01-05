import { cn } from "@/lib/utils";

const TOTAL_DOTS = 8;

/**
 * Returns the active color for a dot based on its position.
 * Dots 1-3: green (low volume)
 * Dot 4: orange (medium volume)
 * Dots 5-8: red (high volume)
 */
const getDotColor = (index: number): string => {
  if (index < 3) return "bg-green-500";
  if (index === 3) return "bg-orange-500";
  return "bg-red-500";
};

/**
 * Volume indicator showing 8 dots with color-coded levels.
 * @param volumeLevel - Normalized volume from 0-1
 */
export const VolumeIndicator = (props: { volumeLevel: number }) => {
  // Map volume to number of filled dots (0-8)
  const filledDots = Math.round(props.volumeLevel * TOTAL_DOTS);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL_DOTS }).map((_, index) => {
        const isFilled = index < filledDots;

        return (
          <div
            key={index}
            className={cn(
              "size-2 rounded-full transition-colors duration-75",
              isFilled ? getDotColor(index) : "bg-gray-400"
            )}
          />
        );
      })}
    </div>
  );
};
