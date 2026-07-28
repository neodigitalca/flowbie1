import { useCallback, useEffect, useState } from "react";
import type { WordPressSite } from "../types";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_PUBLISHED_SELECTED_POSTS_TO_WORDPRESS, NOTIFY_SELECT_AT_LEAST_ONE_PENDING_ROW } from "@/lib/notify-messages";
import { isContentBankNotProvisionedMessage } from "@/lib/content-bank-errors";
import {
  listPostBankRows,
  provisionPostBankTableViaApi,
  publishPostBankRows,
  type PostBankListRow,
} from "@/lib/post-bank-api";

export function usePostBankPanel(site: WordPressSite, enabled: boolean) {
  const [rows, setRows] = useState<PostBankListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const list = await listPostBankRows(site.id, { limit: 80, status: "pending" });
      if (list.error) {
        if (!isContentBankNotProvisionedMessage(list.error)) {
          notify.error(list.error);
        }
        setRows([]);
      } else {
        setRows(list.rows);
      }
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [site.id, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleId = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const publish = useCallback(async () => {
    if (!enabled) return;
    const ids = Array.from(selected);
    if (ids.length === 0) {
      notify.error(NOTIFY_SELECT_AT_LEAST_ONE_PENDING_ROW);
      return;
    }
    setPublishing(true);
    try {
      const res = await publishPostBankRows(site.id, ids);
      if (!res.ok) {
        notify.error(res.error || "Publish failed");
        return;
      }
      const failed = (res.results || []).filter((r) => !r.ok);
      if (failed.length) {
        notify.error(failed.map((f) => `${f.id}: ${f.error || "error"}`).join("; "));
      } else {
        notify.success(NOTIFY_PUBLISHED_SELECTED_POSTS_TO_WORDPRESS);
      }
      const publishedIds = new Set(
        (res.results || []).filter((r) => r.ok).map((r) => String(r.id)),
      );
      if (publishedIds.size > 0) {
        setRows((prev) => prev.filter((row) => !publishedIds.has(String(row.id))));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of publishedIds) {
            next.delete(id);
          }
          return next;
        });
      }
      await refresh();
    } finally {
      setPublishing(false);
    }
  }, [enabled, selected, site.id, refresh]);

  const provisionTable = useCallback(async () => {
    if (!enabled) return;
    setProvisioning(true);
    try {
      const r = await provisionPostBankTableViaApi(site.id, site.name);
      if (!r.ok) {
        notify.error(r.error || "API could not create the bank table");
        return;
      }
      notify.success(
        r.tableName ? `Bank table ready: public.${r.tableName}` : "Bank table is ready",
      );
      await refresh();
    } finally {
      setProvisioning(false);
    }
  }, [enabled, site.id, site.name, refresh]);

  return {
    rows,
    loading,
    provisioning,
    selected,
    publishing,
    refresh,
    toggleId,
    publish,
    provisionTable,
  };
}
