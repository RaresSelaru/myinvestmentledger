"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  importUploadSchema,
  manualTransactionSchema,
} from "@/lib/schemas/manual-entry";
import { SupabaseImportRepository } from "@/lib/import/supabase-import-repository";
import {
  commitXtbImport,
  dryRunXtbImport,
} from "@/lib/import/xtb-import-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}

export async function addManualTransactionAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/transactions?error=Supabase%20is%20not%20configured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

export async function uploadImportAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/imports?error=Supabase%20is%20not%20configured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = importUploadSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    brokerAccountId: formData.get("brokerAccountId"),
  });
  const file = formData.get("file");

  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    redirect("/imports?error=Choose%20a%20broker%20account%20and%20file");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${parsed.data.portfolioId}/${parsed.data.brokerAccountId}/${fileId}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("broker-reports")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    redirect(`/imports?error=${encodeURIComponent(uploadError.message)}`);
  }

  let redirectUrl = "/imports?message=Import%20completed";

  try {
    const result = await commitXtbImport({
      buffer: bytes,
      file: {
        id: fileId,
        userId: user.id,
        portfolioId: parsed.data.portfolioId,
        brokerAccountId: parsed.data.brokerAccountId,
        fileName: file.name,
        fileHash: hash,
        storagePath,
        storageBucket: "broker-reports",
        meta: {
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
        },
      },
      repository: new SupabaseImportRepository(supabase),
    });

    revalidatePath("/imports");
    revalidatePath("/dashboard");
    revalidatePath("/portfolio");
    revalidatePath("/transactions");
    redirectUrl = `/imports?message=Import%20completed&newRows=${result.stats.newRows}&duplicates=${result.stats.duplicatesIgnored}&updated=${result.stats.correctedRows}`;
  } catch (error) {
    redirect(
      `/imports?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Import failed"
      )}`
    );
  }

  redirect(redirectUrl);
}

export async function dryRunImportAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/imports?error=Supabase%20is%20not%20configured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    const result = dryRunXtbImport(Buffer.from(await file.arrayBuffer()), {
      brokerAccountId: parsed.data.brokerAccountId,
    });

    redirectUrl = `/imports?message=Dry%20run%20completed&newRows=${result.stats.parsedRows}&duplicates=0&updated=0&parsed=${result.stats.parsedRows}&lots=${result.stats.positionLots}&cash=${result.stats.cashOperations}&transactions=${result.stats.transactions}`;
  } catch (error) {
    redirect(
      `/imports?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Dry run failed"
      )}`
    );
  }

  redirect(redirectUrl);
}
