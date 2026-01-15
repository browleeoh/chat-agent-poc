import { useEffect } from "react";
import { useContextSelector } from "use-context-selector";
import { streamDeckForwarderMessageSchema } from "stream-deck-forwarder/stream-deck-forwarder-types";
import type { ClipSectionNamingModal } from "../types";
import { VideoStateContext } from "../video-state-context";
import { ClipStateContext } from "../clip-state-context";

/**
 * Hook that manages WebSocket connection to the Stream Deck forwarder.
 *
 * Connects to localhost:5172 and handles messages from the Stream Deck:
 * - delete-last-clip: Triggers deletion of the most recently inserted clip
 * - toggle-last-frame-of-video: Toggles the last frame setting for clips
 * - toggle-beat: Toggles beat/pause between clips
 * - add-clip-section: Opens modal to create a new clip section
 *
 * The socket is automatically closed when the component unmounts.
 */
export function useWebSocket(params: {
  setClipSectionNamingModal: (modal: ClipSectionNamingModal) => void;
  generateDefaultClipSectionName: () => string;
}) {
  const dispatch = useContextSelector(VideoStateContext, (v) => v!.dispatch);
  const onDeleteLatestInsertedClip = useContextSelector(
    ClipStateContext,
    (v) => v!.onDeleteLatestInsertedClip
  );
  const onToggleBeat = useContextSelector(
    ClipStateContext,
    (v) => v!.onToggleBeat
  );

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:5172");
    socket.addEventListener("message", (event) => {
      const data = streamDeckForwarderMessageSchema.parse(
        JSON.parse(event.data)
      );
      if (data.type === "delete-last-clip") {
        onDeleteLatestInsertedClip();
      } else if (data.type === "toggle-last-frame-of-video") {
        dispatch({ type: "toggle-last-frame-of-video" });
      } else if (data.type === "toggle-beat") {
        onToggleBeat();
      } else if (data.type === "add-clip-section") {
        params.setClipSectionNamingModal({
          mode: "create",
          defaultName: params.generateDefaultClipSectionName(),
        });
      }
    });
    return () => {
      socket.close();
    };
  }, [
    dispatch,
    onDeleteLatestInsertedClip,
    onToggleBeat,
    params.setClipSectionNamingModal,
    params.generateDefaultClipSectionName,
  ]);
}
