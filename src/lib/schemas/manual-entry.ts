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

const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().positive().nullable()
);

const optionalPercentNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().min(0).max(100).nullable()
);

export const targetItemSchema = z
  .object({
    symbol: z.string().trim().min(1).max(32),
    targetAllocation: z.coerce.number().min(0).max(100),
    maxAllocation: optionalPercentNumber,
    targetBuyPrice: optionalPositiveNumber,
    targetSellPrice: optionalPositiveNumber,
    corePercent: z.coerce.number().min(0).max(100),
    satellitePercent: z.coerce.number().min(0).max(100),
  })
  .superRefine((value, ctx) => {
    if (
      value.maxAllocation !== null &&
      value.maxAllocation < value.targetAllocation
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAllocation"],
        message: "Max allocation must be greater than or equal to target allocation",
      });
    }

    if (Math.round((value.corePercent + value.satellitePercent) * 100) / 100 !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["corePercent"],
        message: "Core and satellite must add up to 100",
      });
    }
  });

export const bulkTargetsSchema = z.object({
  portfolioId: z.string().uuid(),
  targets: z.array(targetItemSchema).min(1).max(300),
});

export const marketDataProviderSchema = z.enum([
  "finnhub",
  "fmp",
  "alpha_vantage",
  "twelve_data",
]);

export const marketDataSettingsSchema = z.object({
  portfolioId: z.string().uuid(),
  livePricesEnabled: z.coerce.boolean(),
  valuationMode: z.enum(["import_snapshot", "live_prices"]),
  preferredProvider: z.enum([
    "auto",
    "finnhub",
    "fmp",
    "alpha_vantage",
    "twelve_data",
  ]),
  quoteRefreshIntervalSeconds: z.coerce.number().int().min(60).max(3600),
});

export const marketDataApiKeySchema = z.object({
  provider: marketDataProviderSchema,
  apiKey: z.string().trim().min(4).max(300),
});

export const marketDataProviderOnlySchema = z.object({
  provider: marketDataProviderSchema,
});

export const refreshQuotesSchema = z.object({
  portfolioId: z.string().uuid(),
});

export const brokerCashOverrideSchema = z.object({
  portfolioId: z.string().uuid(),
  brokerAccountId: z.string().uuid(),
  amount: z.coerce.number(),
  currency: z.enum(["RON", "EUR", "USD"]),
  comment: z.string().trim().max(300).optional().or(z.literal("")),
});
