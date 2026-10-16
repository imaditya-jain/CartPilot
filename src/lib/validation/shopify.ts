import { z } from "zod";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export const shopDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Shop domain is required")
  .transform((value) => (value.includes(".") ? value : `${value}.myshopify.com`))
  .refine((value) => SHOP_DOMAIN_PATTERN.test(value), {
    message: "Enter a valid Shopify domain, e.g. your-store.myshopify.com",
  });

export const connectStoreSchema = z.object({
  shop: shopDomainSchema,
});

export const syncStoreSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
});
