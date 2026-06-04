"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  importUploadSchema,
  manualTransactionSchema,
  portfolioCreateSchema,
  portfolioSelectSchema,
  stagedImportSchema,
} from "@/lib/schemas/manual-entry";
import { SupabaseImportRepository } from "@/lib/import/supabase-import-repository";
import {
  commitXtbImport,
  dryRunXtbImport,
  type ImportResult,
} from "@/lib/import/xtb-import-service";
import type { XtbWorkbookMeta } from "@/lib/import/xtb-parser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIVE_PORTFOLIO_COOKIE = "mil_active_portfolio_id";
const IMPORT_BUCKET = "broker-reports";

function cleanOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeRedirect(value: FormDataEntryValue | null, fallback = "/dashboard") {
  const redirectTo = typeof value === "string" ? value : "";

  if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    return redirectTo;
  }

  return fallback;
}

function tagList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function requireUser(redirectTo = "/login") {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`${redirectTo}?error=Supabase%20is%20not%20configured`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?message=${encodeURIComponent("Log in to continue.")}`);
  }

  return { supabase, user };
}

function importFailureUrl(error: unknown) {
  return `/imports?error=${encodeURIComponent(
    error instanceof Error ? error.message : "Import failed"
  )}`;
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}

export async function selectPortfolioAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = portfolioSelectSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    redirectTo: formData.get("redirectTo"),
  });
  const redirectTo = safeRedirect(formData.get("redirectTo"));

  if (!parsed.success) {
    redirect(`${redirectTo}?error=Could%20not%20select%20portfolio`);
  }

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .eq("id", parsed.data.portfolioId)
    .maybeSingle();

  if (error || !portfolio?.id) {
    redirect(`${redirectTo}?error=Portfolio%20not%20found`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PORTFOLIO_COOKIE, parsed.data.portfolioId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  revalidatePath("/transactions");
  revalidatePath("/imports");
  revalidatePath("/strategy");
  redirect(redirectTo);
}

export async function createPortfolioAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = portfolioCreateSchema.safeParse({
    name: formData.get("name"),
    tags: formData.get("tags"),
    baseCurrency: formData.get("baseCurrency"),
    redirectTo: formData.get("redirectTo"),
  });
  const redirectTo = safeRedirect(formData.get("redirectTo"));

  if (!parsed.success) {
    redirect(`${redirectTo}?error=Could%20not%20create%20portfolio`);
  }

  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      base_currency: parsed.data.baseCurrency,
      tags: tagList(parsed.data.tags),
    })
    .select("id")
    .single();

  if (error || !portfolio?.id) {
    redirect(`${redirectTo}?error=Could%20not%20create%20portfolio`);
  }

  await supabase.from("portfolio_memberships").insert({
    user_id: user.id,
    portfolio_id: portfolio.id,
    role: "owner",
  });

  await supabase.from("broker_accounts").insert({
    user_id: user.id,
    portfolio_id: portfolio.id,
    name: `XTB ${parsed.data.baseCurrency} account`,
    broker: "XTB",
    base_currency: parsed.data.baseCurrency,
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PORTFOLIO_COOKIE, String(portfolio.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  revalidatePath("/transactions");
  revalidatePath("/imports");
  revalidatePath("/strategy");
  redirect(redirectTo);
}

export async function addManualTransactionAction(formData: FormData) {
  const { supabase, user } = await requireUser("/transactions");

  const parsed = manualTransactionSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    brokerAccountId: formData.get("brokerAccountId"),
    date: formData.get("date"),
    type: formData.get("type"),
    symbol: formData.get("symbol"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    redirect("/transactions?error=Could%20not%20save%20entry");
  }

  await supabase.from("transactions").insert({
    user_id: user.id,
    portfolio_id: parsed.data.portfolioId,
    broker_account_id: cleanOptionalString(parsed.data.brokerAccountId),
    trade_date: parsed.data.date,
    occurred_at: new Date(parsed.data.date).toISOString(),
    type: parsed.data.type,
    transaction_type: parsed.data.type,
    symbol: cleanOptionalString(parsed.data.symbol)?.toUpperCase(),
    quantity: cleanOptionalNumber(parsed.data.quantity),
    price: cleanOptionalNumber(parsed.data.price),
    amount: parsed.data.amount,
    currency: parsed.data.currency.toUpperCase(),
    source: "manual",
    source_type: "manual",
    is_reconciled: false,
    comment: cleanOptionalString(parsed.data.comment),
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect("/transactions?message=Entry%20saved");
}

function emptyImportMeta(): XtbWorkbookMeta {
  return {
    accountNumber: null,
    accountCurrency: null,
    reportStartDate: null,
    reportEndDate: null,
    snapshotAt: null,
    balance: null,
    equity: null,
    margin: null,
    freeMargin: null,
    marginLevel: null,
  };
}

function importResultUrl(message: string, result: ImportResult, stagedImportId?: string) {
  const params = new URLSearchParams({
    message,
    newRows: String(result.stats.newRows),
    duplicates: String(result.stats.duplicatesIgnored),
    updated: String(result.stats.correctedRows),
    parsed: String(result.stats.parsedRows),
    lots: String(result.stats.positionLots),
    cash: String(result.stats.cashOperations),
    transactions: String(result.stats.transactions),
  });

  if (stagedImportId) {
    params.set("stagedImportId", stagedImportId);
  }

  return `/imports?${params.toString()}`;
}

async function commitImportBuffer(input: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  userId: string;
  portfolioId: string;
  brokerAccountId: string;
  fileName: string;
  fileHash: string;
  storagePath: string;
  storageBucket: string;
  bytes: Buffer;
  meta?: XtbWorkbookMeta | null;
}) {
  console.info("[xtb-import] commit:start", {
    userId: input.userId,
    portfolioId: input.portfolioId,
    brokerAccountId: input.brokerAccountId,
    fileHash: input.fileHash,
    size: input.bytes.byteLength,
  });

  const result = await commitXtbImport({
    buffer: input.bytes,
    file: {
      id: crypto.randomUUID(),
      userId: input.userId,
      portfolioId: input.portfolioId,
      brokerAccountId: input.brokerAccountId,
      fileName: input.fileName,
      fileHash: input.fileHash,
      storagePath: input.storagePath,
      storageBucket: input.storageBucket,
      meta: input.meta ?? emptyImportMeta(),
    },
    repository: new SupabaseImportRepository(input.supabase),
  });

  console.info("[xtb-import] commit:complete", {
    importedFileId: result.importedFileId,
    stats: result.stats,
  });

  return result;
}

export async function dryRunImportAction(formData: FormData) {
  const { supabase, user } = await requireUser("/imports");
  const parsed = importUploadSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    brokerAccountId: formData.get("brokerAccountId"),
  });
  const file = formData.get("file");

  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    redirect("/imports?error=Choose%20a%20broker%20account%20and%20file");
  }

  let redirectUrl = "/imports?message=Dry%20run%20completed";

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const result = dryRunXtbImport(bytes, {
      brokerAccountId: parsed.data.brokerAccountId,
    });
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const stagedImportId = crypto.randomUUID();
    const storagePath = `${user.id}/staged/${stagedImportId}-${safeName}`;

    console.info("[xtb-import] dry-run:upload", {
      userId: user.id,
      portfolioId: parsed.data.portfolioId,
      brokerAccountId: parsed.data.brokerAccountId,
      fileHash,
      parsedRows: result.stats.parsedRows,
    });

    const { error: uploadError } = await supabase.storage
      .from(IMPORT_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { error: stageError } = await supabase.from("staged_imports").insert({
      id: stagedImportId,
      user_id: user.id,
      portfolio_id: parsed.data.portfolioId,
      broker_account_id: parsed.data.brokerAccountId,
      file_name: file.name,
      file_hash: fileHash,
      storage_bucket: IMPORT_BUCKET,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      dry_run_stats: result.stats,
      meta: result.meta,
      status: "staged",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (stageError) {
      await supabase.storage.from(IMPORT_BUCKET).remove([storagePath]);
      throw stageError;
    }

    redirectUrl = importResultUrl("Dry run completed", result, stagedImportId);
  } catch (error) {
    console.error("[xtb-import] dry-run:failed", error);
    redirect(
      `/imports?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Dry run failed"
      )}`
    );
  }

  redirect(redirectUrl);
}

export async function commitStagedImportAction(formData: FormData) {
  const { supabase, user } = await requireUser("/imports");
  const parsed = stagedImportSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    brokerAccountId: formData.get("brokerAccountId"),
    stagedImportId: formData.get("stagedImportId"),
  });

  if (!parsed.success) {
    redirect("/imports?error=Choose%20a%20broker%20account%20and%20file");
  }

  const stagedImportId = parsed.data.stagedImportId || null;
  let redirectUrl = "/imports?message=Import%20completed";

  try {
    let bytes: Buffer;
    let fileName: string;
    let fileHash: string;
    let storagePath: string;
    let storageBucket = IMPORT_BUCKET;
    let meta: XtbWorkbookMeta | null = null;

    if (stagedImportId) {
      const { data: staged, error: stagedError } = await supabase
        .from("staged_imports")
        .select("*")
        .eq("id", stagedImportId)
        .eq("user_id", user.id)
        .eq("status", "staged")
        .maybeSingle();

      if (stagedError || !staged) {
        throw stagedError ?? new Error("Staged import not found. Run dry run again.");
      }

      if (new Date(String(staged.expires_at)).getTime() < Date.now()) {
        await supabase
          .from("staged_imports")
          .update({ status: "expired" })
          .eq("id", stagedImportId)
          .eq("user_id", user.id);
        throw new Error("Staged import expired. Run dry run again.");
      }

      const { data: storedFile, error: downloadError } = await supabase.storage
        .from(String(staged.storage_bucket))
        .download(String(staged.storage_path));

      if (downloadError || !storedFile) {
        throw downloadError ?? new Error("Could not load staged import file.");
      }

      bytes = Buffer.from(await storedFile.arrayBuffer());
      fileName = String(staged.file_name);
      fileHash = String(staged.file_hash);
      storagePath = String(staged.storage_path);
      storageBucket = String(staged.storage_bucket);
      meta = (staged.meta as XtbWorkbookMeta | null) ?? null;
    } else {
      const file = formData.get("file");

      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Choose a file or run dry run first.");
      }

      bytes = Buffer.from(await file.arrayBuffer());
      fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
      fileName = file.name;
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const directFileId = crypto.randomUUID();
      storagePath = `${user.id}/${parsed.data.portfolioId}/${parsed.data.brokerAccountId}/${directFileId}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(IMPORT_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }
    }

    const result = await commitImportBuffer({
      supabase,
      userId: user.id,
      portfolioId: parsed.data.portfolioId,
      brokerAccountId: parsed.data.brokerAccountId,
      fileName,
      fileHash,
      storagePath,
      storageBucket,
      bytes,
      meta,
    });

    if (stagedImportId) {
      await supabase
        .from("staged_imports")
        .update({ status: "imported", error_message: null })
        .eq("id", stagedImportId)
        .eq("user_id", user.id);
    }

    revalidatePath("/imports");
    revalidatePath("/dashboard");
    revalidatePath("/portfolio");
    revalidatePath("/transactions");
    redirectUrl = importResultUrl("Import completed", result);
  } catch (error) {
    console.error("[xtb-import] commit:failed", error);
    if (stagedImportId) {
      await supabase
        .from("staged_imports")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Import failed",
        })
        .eq("id", stagedImportId)
        .eq("user_id", user.id);
    }
    redirect(importFailureUrl(error));
  }

  redirect(redirectUrl);
}

export async function uploadImportAction(formData: FormData) {
  return commitStagedImportAction(formData);
}
