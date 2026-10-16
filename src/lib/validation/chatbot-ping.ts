import { z } from "zod";

export const chatbotPingSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
});
export type ChatbotPingInput = z.infer<typeof chatbotPingSchema>;
