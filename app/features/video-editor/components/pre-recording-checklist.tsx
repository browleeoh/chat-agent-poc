import { Button } from "@/components/ui/button";
import {
  CircleQuestionMarkIcon,
  MonitorIcon,
  Columns2,
  UserRound,
} from "lucide-react";

/**
 * Pre-recording checklist component shown when no clips exist yet.
 * Displays a checklist of items to verify before recording and an
 * "Add Intro Section" button to create the first section.
 */
export const PreRecordingChecklist = (props: {
  onAddIntroSection: () => void;
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
        <CircleQuestionMarkIcon className="size-6" />
        Pre-recording checklist
      </h2>
      <ol className="space-y-3 text-base mb-6">
        <li className="flex items-center gap-3">
          <MonitorIcon className="size-5 flex-shrink-0 text-gray-300" />
          <span>Close the windows</span>
        </li>
        <li className="flex items-center gap-3">
          <Columns2 className="size-5 flex-shrink-0 text-gray-300" />
          <span>Close the blinds</span>
        </li>
        <li className="flex items-center gap-3">
          <UserRound className="size-5 flex-shrink-0 text-gray-300" />
          <span>Check bookshelf books are standing up properly</span>
        </li>
      </ol>
      <Button
        onClick={props.onAddIntroSection}
        className="w-full"
        variant="outline"
      >
        Add Intro Section
      </Button>
    </div>
  );
};
