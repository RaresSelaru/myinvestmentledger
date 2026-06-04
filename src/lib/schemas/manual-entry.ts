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

export const portfolioCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tags: z
    .string()
    .trim()
    .max(160)
    .optional()
    .or(z.literal("")),
  baseCurrency: z.enum(["RON", "EUR", "USD"]),
  redirectTo: z.string().optional().or(z.literal("")),
});

export const portfolioSelectSchema = z.object({
  portfolioId: z.string().uuid(),
  redirectTo: z.string().optional().or(z.literal("")),
});

export const stagedImportSchema = z.object({
  portfolioId: z.string().uuid(),
  brokerAccountId: z.string().uuid(),
  stagedImportId: z.string().uuid().optional().or(z.literal("")),
});
