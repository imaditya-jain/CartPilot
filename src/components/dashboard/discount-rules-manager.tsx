"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Tag } from "lucide-react";
import { discountRuleSchema, type DiscountRuleInput } from "@/lib/validation/discount";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DiscountRule {
  id: string;
  storeId: string;
  name: string;
  triggerType: DiscountRuleInput["triggerType"];
  minOrderCount: number | null;
  minLifetimeSpend: number | null;
  tag: string | null;
  discountType: DiscountRuleInput["discountType"];
  discountValue: number;
  appliesOncePerCustomer: boolean;
  active: boolean;
  timesRedeemed: number;
  lastRedeemedAt: string | null;
}

const TRIGGER_OPTIONS = [
  { value: "first_time_customer", label: "First-time customer" },
  { value: "returning_customer", label: "Returning customer (min. orders)" },
  { value: "min_lifetime_spend", label: "Minimum lifetime spend" },
  { value: "cart_contains_tag", label: "Suggested product has tag" },
] as const;

function describeRule(rule: DiscountRule): string {
  switch (rule.triggerType) {
    case "first_time_customer":
      return "Customer's first order";
    case "returning_customer":
      return `${rule.minOrderCount ?? 0}+ previous orders`;
    case "min_lifetime_spend":
      return `Lifetime spend ≥ ${rule.minLifetimeSpend ?? 0}`;
    case "cart_contains_tag":
      return `Suggested product tagged "${rule.tag ?? ""}"`;
  }
}

function describeDiscount(rule: DiscountRule): string {
  return rule.discountType === "percentage" ? `${rule.discountValue}% off` : `${rule.discountValue} off`;
}

const DEFAULT_VALUES: Partial<DiscountRuleInput> = {
  triggerType: "returning_customer",
  discountType: "percentage",
  appliesOncePerCustomer: true,
  active: true,
};

export function DiscountRulesManager({ storeId }: { storeId: string }) {
  const [rules, setRules] = useState<DiscountRule[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DiscountRuleInput>({
    resolver: zodResolver(discountRuleSchema),
    defaultValues: { ...DEFAULT_VALUES, storeId },
  });
  const triggerType = watch("triggerType");

  const loadRules = useCallback(async () => {
    try {
      const data = await apiRequest<DiscountRule[]>(`/api/discounts/rules?storeId=${storeId}`);
      setRules(data);
      setListError(null);
    } catch (error) {
      setListError(error instanceof ApiClientError ? error.message : "Couldn't load discount rules.");
    }
  }, [storeId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const onSubmit = async (input: DiscountRuleInput) => {
    setFormError(null);
    try {
      await apiRequest<DiscountRule>("/api/discounts/rules", { method: "POST", body: input });
      reset({ ...DEFAULT_VALUES, storeId });
      await loadRules();
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "Couldn't save the discount rule.");
    }
  };

  const onDelete = async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      await apiRequest(`/api/discounts/rules/${ruleId}?storeId=${storeId}`, { method: "DELETE" });
      await loadRules();
    } catch (error) {
      setListError(error instanceof ApiClientError ? error.message : "Couldn't delete the discount rule.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted" aria-hidden="true" />
          <CardTitle>Discount rules</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted">
          When a rule matches a shopper&apos;s order history, the chatbot can surface it as an offer and create a
          real, redeemable code in Shopify. Rules are only evaluated when &ldquo;Offer eligibility
          messaging&rdquo; is on, above.
        </p>

        {listError && <p className="text-sm text-danger">{listError}</p>}

        {rules === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-background" />
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted">No discount rules yet — add one below.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                    <Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Paused"}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {describeRule(rule)} → {describeDiscount(rule)} · redeemed {rule.timesRedeemed}×
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isLoading={deletingId === rule.id}
                  onClick={() => onDelete(rule.id)}
                  aria-label={`Delete rule: ${rule.name}`}
                >
                  <Trash2 className="h-4 w-4 text-muted" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-4">
          <input type="hidden" {...register("storeId")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ruleName">Rule name</Label>
              <Input id="ruleName" hasError={!!errors.name} placeholder="e.g. Loyal customer 10%" {...register("name")} />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="triggerType">Trigger</Label>
              <Select id="triggerType" {...register("triggerType")}>
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {triggerType === "returning_customer" && (
            <div>
              <Label htmlFor="minOrderCount">Minimum previous orders</Label>
              <Input id="minOrderCount" type="number" min={1} hasError={!!errors.minOrderCount} {...register("minOrderCount")} />
              <FieldError>{errors.minOrderCount?.message}</FieldError>
            </div>
          )}
          {triggerType === "min_lifetime_spend" && (
            <div>
              <Label htmlFor="minLifetimeSpend">Minimum lifetime spend</Label>
              <Input
                id="minLifetimeSpend"
                type="number"
                min={0}
                step="0.01"
                hasError={!!errors.minLifetimeSpend}
                {...register("minLifetimeSpend")}
              />
              <FieldError>{errors.minLifetimeSpend?.message}</FieldError>
            </div>
          )}
          {triggerType === "cart_contains_tag" && (
            <div>
              <Label htmlFor="tag">Product tag</Label>
              <Input id="tag" placeholder="e.g. vip" hasError={!!errors.tag} {...register("tag")} />
              <FieldError>{errors.tag?.message}</FieldError>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="discountType">Discount type</Label>
              <Select id="discountType" {...register("discountType")}>
                <option value="percentage">Percentage off</option>
                <option value="fixed_amount">Fixed amount off</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="discountValue">Discount value</Label>
              <Input
                id="discountValue"
                type="number"
                min={0}
                step="0.01"
                hasError={!!errors.discountValue}
                {...register("discountValue")}
              />
              <FieldError>{errors.discountValue?.message}</FieldError>
            </div>
          </div>

          <Controller
            control={control}
            name="appliesOncePerCustomer"
            render={({ field }) => (
              <Switch
                id="appliesOncePerCustomer"
                checked={field.value}
                onChange={field.onChange}
                label="Limit to one redemption per customer"
                description="Prevents the same shopper from getting this offer more than once."
              />
            )}
          />
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch
                id="ruleActive"
                checked={field.value}
                onChange={field.onChange}
                label="Active"
                description="Inactive rules are kept but never offered."
              />
            )}
          />

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <Button type="submit" variant="secondary" isLoading={isSubmitting}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add rule
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
