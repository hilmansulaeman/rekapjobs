import { getAllPending, removePendingExpense } from "./offline-queue";

export type SyncProgressCallback = (synced: number, total: number, failed: number) => void;

export async function syncPendingExpenses(onProgress?: SyncProgressCallback): Promise<{
  synced: number;
  failed: number;
}> {
  const pending = await getAllPending();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entry.formData,
          createdAt: entry.createdAt,
        }),
      });

      const isAuthFailure = response.redirected || response.status === 401;

      if (response.ok && !isAuthFailure) {
        await removePendingExpense(entry.id);
        synced++;
      } else {
        // If validation failed (400), remove it — it will never succeed.
        // If server error (500), keep for retry.
        // For auth failures (redirect/401), also keep for later retry after login.
        if (response.status === 400) {
          await removePendingExpense(entry.id);
        }
        failed++;
      }
    } catch {
      // Network error — stop trying, we're probably still offline
      failed += pending.length - synced - failed;
      break;
    }

    onProgress?.(synced, pending.length, failed);
  }

  return { synced, failed };
}
