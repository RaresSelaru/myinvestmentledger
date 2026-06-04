import { Plus } from "lucide-react";
import { addManualTransactionAction } from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BrokerAccount, Portfolio } from "@/lib/types";

export function ManualEntryDialog({
  portfolio,
  brokerAccounts,
}: {
  portfolio: Portfolio;
  brokerAccounts: BrokerAccount[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          Add entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual ledger entry</DialogTitle>
        </DialogHeader>
        <form action={addManualTransactionAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="portfolioId" value={portfolio.id} />
          <div className="space-y-2">
            <Label>Date</Label>
            <Input name="date" type="date" required />
          </div>
          <div className="space-y-2">
            <Label>Broker account</Label>
            <Select name="brokerAccountId" defaultValue={brokerAccounts[0]?.id}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {brokerAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select name="type" defaultValue="buy">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="fee">Fee/tax</SelectItem>
                <SelectItem value="internal_transfer">Internal transfer</SelectItem>
                <SelectItem value="note">Note/comment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Symbol</Label>
            <Input name="symbol" placeholder="AAPL" />
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input name="quantity" inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label>Price</Label>
            <Input name="price" inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input name="amount" inputMode="decimal" required />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input name="currency" defaultValue={portfolio.baseCurrency} maxLength={3} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Comment</Label>
            <Textarea name="comment" rows={3} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save entry</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
