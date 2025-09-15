import { once } from "node:events";
import {
  createStreamDeckForwarderMessage,
  type StreamDeckForwarderMessage,
} from "./stream-deck-forwarder-types";

export const sendStreamDeckForwarderMessage = async (
  message: StreamDeckForwarderMessage
) => {
  const ws = new WebSocket("ws://localhost:5172");
  await once(ws, "open");
  ws.send(createStreamDeckForwarderMessage(message));
  ws.close();
};
