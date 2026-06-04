import { z } from "zod";

export const transactionTypeSchema = z.enum([
  "buy",
  "sell",
  "deposit",
  "withdrawal",
  "fee",
  "tax",
  "dividend",
  "internal_transfer",
  "note",
]);

export const manualTransactionSchema = z.object({
  portfolioId: z.string().uuid(),
  brokerAccountId: z.string().uuid().optional().or(z.literal("")),
  date: z.string().min(1),
  type: transactionTypeSchema,
  symbol: z.string().trim().max(16).optional().or(z.literal("")),
  quantity: z.coerce.number().nonnegative().optional().or(z.literal("")),
  price: z.coerce.number().nonnegative().optional().or(z.literal("")),
  amount: z.coerce.number(),
  currency: z.string().trim().length(3),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});

export const importUploadSchema = z.object({
  portfolioId: z.string().uuid(),
  brokerAccountId: z.string().uuid(),
});
