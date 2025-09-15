import { z } from "zod";

export const streamDeckForwarderMessageSchema = z.object({
  type: z.enum(["delete-last-clip"]),
});

export type StreamDeckForwarderMessage = z.infer<
  typeof streamDeckForwarderMessageSchema
>;

export const createStreamDeckForwarderMessage = (
  message: StreamDeckForwarderMessage
) => {
  return JSON.stringify(message);
};
