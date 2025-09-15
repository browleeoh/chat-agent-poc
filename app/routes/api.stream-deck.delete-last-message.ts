import { sendStreamDeckForwarderMessage } from "stream-deck-forwarder/send-stream-deck-forwarder-message";

export const loader = async () => {
  await sendStreamDeckForwarderMessage({
    type: "delete-last-clip",
  });

  return new Response("ok", { status: 200 });
};
