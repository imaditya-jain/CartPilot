import { z } from "zod";

export const chatbotTestMessageSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  customerId: z.string().min(1, "customerId is required"),
  message: z.string().trim().min(1, "Message cannot be empty").max(500, "Message is too long"),
});
export type ChatbotTestMessageInput = z.infer<typeof chatbotTestMessageSchema>;
