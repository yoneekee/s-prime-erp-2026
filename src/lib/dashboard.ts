import { TRANSITIONS, canExecute, type WorkflowSlip, type WorkflowUser } from "@/lib/workflow";

/** 操作可否はワークフロー定義に委譲し、表示用のタスクを生成する。 */
export function getPendingTasks<T extends WorkflowSlip & { date: string }>(slips: T[], user: WorkflowUser | null) {
  if (!user) return [];
  return slips.map(slip => ({
    slip,
    actions: [...new Set(TRANSITIONS[slip.slipType]
      .filter(def => canExecute(slip, def.action, user).ok)
      .map(def => def.label))],
  })).filter(task => task.actions.length > 0)
    .sort((a, b) => b.slip.date.localeCompare(a.slip.date) || b.slip.slipNo.localeCompare(a.slip.slipNo));
}

/** 全伝票の履歴を処理日時の降順でまとめる。ストアは変更しない。 */
export function getRecentActivity<T extends WorkflowSlip>(slips: T[], limit: number) {
  return slips.flatMap(slip => slip.workflow.map(entry => ({
    ...entry,
    slipNo: slip.slipNo,
    slipType: slip.slipType,
    label: entry.status,
    key: `${slip.slipNo}${entry.stepNo}`,
  }))).sort((a, b) => activityTime(b.procAt) - activityTime(a.procAt)
    || b.slipNo.localeCompare(a.slipNo) || b.stepNo - a.stepNo)
    .slice(0, Math.max(0, limit));
}

export function getSlipDetailPath(slip: Pick<WorkflowSlip, "slipType" | "slipNo">): string {
  const page = slip.slipType === "PROD" ? "/production/execution" : "/production/shipping";
  return `${page}?slipNo=${encodeURIComponent(slip.slipNo)}`;
}

function activityTime(timestamp: string): number {
  return new Date(timestamp.replace(" ", "T")).getTime();
}

export function isActivityUnread(entry: { key: string; procAt: string }, readAt: string, readKeys: string[]): boolean {
  return activityTime(entry.procAt) > activityTime(readAt) && !readKeys.includes(entry.key);
}

export function getActivityType(label: string): "warning" | "success" | "info" {
  if (["否認", "差戻"].includes(label)) return "warning";
  if (["最終承認", "検収完了", "売上確定"].includes(label)) return "success";
  return "info";
}

export function getSafetyStockAlerts<T extends { isActive: boolean; stockQty: number; safetyStock: number }>(items: T[]): T[] {
  return items.filter(item => item.isActive && item.stockQty < item.safetyStock)
    .sort((a, b) => a.stockQty / a.safetyStock - b.stockQty / b.safetyStock);
}

export function getDashboardCounts(slips: WorkflowSlip[], items: { isActive: boolean; stockQty: number; safetyStock: number }[]) {
  return {
    pending: slips.filter(slip => ["S01", "A00"].includes(slip.status)).length,
    purchasing: slips.filter(slip => slip.slipType === "PROD" && ["P01", "P02", "P03", "P04"].includes(slip.status)).length,
    shipping: slips.filter(slip => slip.slipType === "SHIP" && ["T01", "T02"].includes(slip.status)).length,
    lowStock: getSafetyStockAlerts(items).length,
  };
}