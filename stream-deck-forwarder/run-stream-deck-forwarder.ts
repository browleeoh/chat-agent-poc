import { WebSocketServer, WebSocket } from "ws";
import {
  streamDeckForwarderMessageSchema,
  type StreamDeckForwarderMessage,
} from "./stream-deck-forwarder-types";

const wss = new WebSocketServer({ port: 5172 }, () => {
  console.log("Stream Deck Forwarder server started on port 5172");
});

const clients = new Map<string, WebSocket>();

const sendMessage = (from: string, message: StreamDeckForwarderMessage) => {
  clients.entries().forEach(([id, client]) => {
    if (id === from) {
      return;
    }

    client.send(JSON.stringify(message));
  });
};

wss.on("connection", (ws) => {
  console.log("Client connected");
  const connectionId = crypto.randomUUID();
  clients.set(connectionId, ws);

  ws.on("message", (message) => {
    try {
      const parsedMessage = streamDeckForwarderMessageSchema.parse(
        JSON.parse(message.toString())
      );

      sendMessage(connectionId, parsedMessage);
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    clients.delete(connectionId);
  });
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(connectionId);
  });
});
