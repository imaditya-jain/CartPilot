"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Store as StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface AuditMessage {
  role: string;
  content: string;
}

interface AiAuditRow {
  _id: string;
  operation: "chat_reply" | "chat_retrieval" | "knowledge_index" | "ai_insight";
  model: string;
  generationConfig?: { temperature: number; maxTokens: number; enableThinking: boolean } | null;
  status: "success" | "error" | "not_configured";
  inputMessages: AuditMessage[];
  output: string | null;
  errorMessage: string | null;
  providerStatus: number | null;
  durationMs: number;
  createdAt: string;
}

interface AuditPageResponse {
  audits: AiAuditRow[];
  knowledgeBatches: Array<{
    _id: string;
    kind: "products" | "orders";
    batchIndex: number;
    summary: string;
    sourceData: string;
    updatedAt: string;
  }>;
  total: number;
  nextOffset: number;
  hasMore: boolean;
}

const OPERATION_LABELS: Record<AiAuditRow["operation"], string> = {
  chat_reply: "Chat reply",
  chat_retrieval: "Chat catalog retrieval",
  knowledge_index: "Knowledge indexing",
  ai_insight: "AI insight",
};

function statusTone(status: AiAuditRow["status"]): "success" | "danger" | "warning" {
  if (status === "success") return "success";
  return status === "not_configured" ? "warning" : "danger";
}

export default function AiAuditsPage() {
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);
  const [audits, setAudits] = useState<AiAuditRow[]>([]);
  const [knowledgeBatches, setKnowledgeBatches] = useState<AuditPageResponse["knowledgeBatches"]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (append = false) => {
    if (!activeStore) return;
    (append ? setLoadingMore : setLoading)(true);
    setError(null);
    try {
      const offset = append ? nextOffset : 0;
      const result = await apiRequest<AuditPageResponse>(
        `/api/ai/audits?storeId=${activeStore.id}&offset=${offset}`
      );
      setAudits((current) => append ? [...current, ...result.audits] : result.audits);
      setKnowledgeBatches(result.knowledgeBatches);
      setTotal(result.total);
      setNextOffset(result.nextOffset);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load AI audit records.");
    } finally {
      (append ? setLoadingMore : setLoading)(false);
    }
  }, [activeStore, nextOffset]);

  useEffect(() => {
    setAudits([]);
    setKnowledgeBatches([]);
    setNextOffset(0);
    setTotal(0);
    setHasMore(false);
    if (activeStore) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore?.id]);

  if (storesStatus === "succeeded" && stores.length === 0) {
    return <div>
      <PageHeader title="AI Audits" description="Inspect the exact data sent to the AI provider and each response." />
      <EmptyState icon={StoreIcon} title="No store connected" description="Connect a Shopify store to view its AI audit history." />
    </div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="AI Audits" description="Inspect the exact prompts, store data, model responses, and status for each NVIDIA request." />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{total} recorded AI request{total === 1 ? "" : "s"} for this store</p>
        <Button size="sm" variant="secondary" onClick={() => void load(false)} isLoading={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </Button>
      </div>
      {error && <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
      {loading && audits.length === 0 ? (
        <div className="h-48 animate-pulse rounded-lg bg-surface" />
      ) : audits.length === 0 && knowledgeBatches.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No AI audits yet" description="New NVIDIA requests will appear here with their input data and response." />
      ) : audits.length > 0 ? (
        <>
          <div className="space-y-3">
            {audits.map((audit) => (
              <Card key={audit._id}>
                <CardHeader className="flex-wrap">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CardTitle>{OPERATION_LABELS[audit.operation]}</CardTitle>
                    <Badge tone={statusTone(audit.status)}>{audit.status.replace("_", " ")}</Badge>
                    <Badge>{audit.model}</Badge>
                  </div>
                  <div className="shrink-0 text-xs text-muted">
                    {new Date(audit.createdAt).toLocaleString()} · {audit.durationMs} ms
                    {audit.providerStatus ? ` · HTTP ${audit.providerStatus}` : ""}
                  </div>
                </CardHeader>
                <CardContent>
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Show exact prompt data and response</summary>
                    <div className="mt-4 space-y-4">
                      {audit.generationConfig && <section>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Generation settings</h4>
                        <p className="text-xs text-foreground">Temperature {audit.generationConfig.temperature} · Max tokens {audit.generationConfig.maxTokens} · Thinking {audit.generationConfig.enableThinking ? "enabled" : "disabled"}</p>
                      </section>}
                      {audit.inputMessages.map((message, index) => (
                        <section key={`${audit._id}-input-${index}`}>
                          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Input · {message.role}</h4>
                          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 text-xs text-foreground">{message.content}</pre>
                        </section>
                      ))}
                      {audit.output && <section>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Model output</h4>
                        <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 text-xs text-foreground">{audit.output}</pre>
                      </section>}
                      {audit.errorMessage && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{audit.errorMessage}</p>}
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
          {hasMore && <div className="flex justify-center"><Button variant="secondary" onClick={() => void load(true)} isLoading={loadingMore}>Load older audits</Button></div>}
        </>
      ) : null}
      {knowledgeBatches.length > 0 && <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Current indexed data sent to NVIDIA</h2>
          <p className="mt-1 text-sm text-muted">Stored product and order batches used to build the chatbot knowledge index.</p>
        </div>
        {knowledgeBatches.map((batch) => (
          <Card key={batch._id}>
            <CardHeader className="flex-wrap">
              <CardTitle>{batch.kind === "products" ? "Product batch" : "Order batch"} · {batch.batchIndex + 1}</CardTitle>
              <span className="text-xs text-muted">Indexed {new Date(batch.updatedAt).toLocaleString()}</span>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">Show batch data and AI summary</summary>
                <div className="mt-4 space-y-4">
                  <section>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">AI summary</h4>
                    <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 text-xs text-foreground">{batch.summary}</pre>
                  </section>
                  <section>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Batch data sent to NVIDIA</h4>
                    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 text-xs text-foreground">{JSON.stringify(JSON.parse(batch.sourceData), null, 2)}</pre>
                  </section>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </section>}
    </div>
  );
}
