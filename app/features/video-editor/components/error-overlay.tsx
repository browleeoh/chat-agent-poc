import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import type { EditorError } from "../clip-state-reducer";

/**
 * ErrorOverlay component displays a full-screen error overlay when a fatal error occurs.
 *
 * Shows:
 * - Warning icon
 * - Error message explaining the issue
 * - Operation that failed and technical error details
 * - Refresh button to reload the page
 */
export const ErrorOverlay = (props: { error: EditorError }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-zinc-900 border border-red-500 rounded-lg p-8 max-w-md mx-4 text-center">
        <AlertTriangleIcon className="size-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">
          Video Editor Error
        </h2>
        <p className="text-zinc-400 mb-4">
          A fatal error occurred while performing an operation. The editor state
          may be out of sync with the database.
        </p>
        <div className="bg-zinc-800 rounded p-3 mb-6 text-left">
          <p className="text-sm text-zinc-500 mb-1">
            Operation:{" "}
            <span className="text-zinc-300">{props.error.effectType}</span>
          </p>
          <p className="text-sm text-red-400 font-mono break-all">
            {props.error.message}
          </p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <RefreshCwIcon className="size-4 mr-2" />
          Refresh Page
        </Button>
      </div>
    </div>
  );
};
