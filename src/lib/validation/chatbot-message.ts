import { z } from "zod";

export const chatMessageSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  visitorId: z.string().min(1, "visitorId is required").max(100),
  message: z.string().trim().min(1, "Message cannot be empty").max(500, "Message is too long"),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
