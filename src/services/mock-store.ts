/**
 * フロントエンド専用の擬似バックエンドストア
 * - localStorage に永続化
 * - 全ページ共通の slip 一覧 / ワークフロー履歴を保持
 * - useSyncExternalStore で React と同期
 *
 * 本物の C# バックエンドが用意できるまでの代替として、承認プロセスや
 * 伝票作成などの「書き込み系」操作を全て frontend だけで完結させる。
 * 遷移ルール自体は src/lib/workflow.ts が Single Source of Truth。
 */

import { createMockSlips, mockEmployees, type MockSlipRecord } from "./mock-data";
import {
  applyTransition,
  canEditSlip,
  type ActionId,
  type WorkflowUser,
} from "@/lib/workflow";

export interface WorkflowEntry {
  stepNo: number;
  action: string;
  status: string; // アクションの表示ラベル
  fromStatus: string;
  toStatus: string;
  empId: number;
  empName: string;
  role: string; // roleLabel
  comment: string;
  procAt: string;
}

export interface SlipFull extends MockSlipRecord {
  workflow: WorkflowEntry[];
}

const STORAGE_KEY = "erp_slip_store_v4";

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** API 呼び出し風の遅延 (300〜500ms) */
const simulateLatency = () =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, 300 + Math.floor(Math.random() * 200))
  );

// ========================================
// シード用ワークフロー履歴
// ========================================

function seedActor(empId: number, role: string) {
  const employee = mockEmployees.find(row => row.empId === empId);
  if (!employee) throw new Error("デモ社員が見つかりません");
  return { empId, empName: employee.empName, role };
}

const SEED_ACTORS = {
  applicant: seedActor(1001, "申請者"),
  approver1: seedActor(1002, "一次承認者"),
  approver2: seedActor(1003, "最終承認者"),
  purchaser: seedActor(1004, "購買担当"),
  inspector: seedActor(1006, "検収担当"),
  shipper: seedActor(1005, "出庫担当"),
} as const;

/** シード伝票のステータスに対応する完全なワークフロー履歴を構築する */
function seedWorkflow(s: MockSlipRecord): WorkflowEntry[] {
  const entries: WorkflowEntry[] = [];
  const push = (
    action: string,
    label: string,
    fromStatus: string,
    toStatus: string,
    actor: { empId: number; empName: string; role: string },
    comment = "-"
  ) => {
    entries.push({
      stepNo: entries.length + 1,
      action,
      status: label,
      fromStatus,
      toStatus,
      empId: actor.empId,
      empName: actor.empName,
      role: actor.role,
      comment,
      // 伝票日付 09:00 から 1 ステップごとに 1 時間加算
      procAt: `${s.date} ${String(9 + entries.length).padStart(2, "0")}:00:00`,
    });
  };

  if (s.status === "S00") return entries;
  push("apply", "申請", "S00", "S01", SEED_ACTORS.applicant);
  if (s.status === "S01") return entries;
  if (s.status === "A02") {
    push("reject", "否認", "S01", "A02", SEED_ACTORS.approver1, "数量の根拠が不足しているため否認します");
    return entries;
  }
  push("approve1", "一次承認", "S01", "A00", SEED_ACTORS.approver1);
  if (s.status === "A00") return entries;
  push("approveFinal", "最終承認", "A00", "A01", SEED_ACTORS.approver2);
  if (s.status === "A01") return entries;

  if (s.slipType === "PROD") {
    push("startEstimate", "見積開始", "A01", "P01", SEED_ACTORS.purchaser);
    if (s.status === "P01") return entries;
    push("order", "発注確定", "P01", "P02", SEED_ACTORS.purchaser);
    if (s.status === "P02") return entries;
    push("partialReceive", "分納入庫", "P02", "P03", SEED_ACTORS.purchaser);
    if (s.status === "P03") return entries;
    push("receive", "入庫完了", "P03", "P04", SEED_ACTORS.purchaser);
    if (s.status === "P04") return entries;
    push("inspect", "検収完了", "P04", "I00", SEED_ACTORS.inspector);
    return entries;
  }

  push("ship", "配送開始（積送）", "A01", "T01", SEED_ACTORS.shipper);
  if (s.status === "T01") return entries;
  push("completeShipment", "出庫完了", "T01", "T02", SEED_ACTORS.shipper);
  if (s.status === "T02") return entries;
  push("confirmSales", "売上確定", "T02", "T03", SEED_ACTORS.shipper);
  return entries;
}

function seed(): SlipFull[] {
  return createMockSlips().map((s) => ({ ...s, workflow: seedWorkflow(s) }));
}

function load(): SlipFull[] {
  if (typeof window === "undefined") return seed();
  try {
    window.localStorage.removeItem("erp_slip_store_v1");
    window.localStorage.removeItem("erp_slip_store_v2");
    window.localStorage.removeItem("erp_slip_store_v3");
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SlipFull[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const s = seed();
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  return s;
}

let state: SlipFull[] = load();
const listeners = new Set<() => void>();

function persist(nextState: SlipFull[] = state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}
function emit() { listeners.forEach((l) => l()); }

/** add / update の入力。requester 系フィールドは user から上書きされる */
export type NewSlip = Omit<MockSlipRecord, "itemCount" | "totalAmount">;

/** 明細の detailId / supplyAmount / 件数 / 合計を再計算する */
function buildDetails(rows: MockSlipRecord["details"]) {
  const details = rows.map((row, index) => ({
    ...row, detailId: index + 1, supplyAmount: row.orderQty * row.unitPrice,
  }));
  return {
    details,
    itemCount: details.length,
    totalAmount: details.reduce((sum, row) => sum + row.supplyAmount, 0),
  };
}

export const slipStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
  getSnapshot(): SlipFull[] { return state; },

  get(slipNo: string): SlipFull | undefined {
    return state.find((s) => s.slipNo === slipNo);
  },

  /** 新規伝票の作成 (S00 一時保存 / S01 申請)。起票は申請者ロールのみ。 */
  async add(slip: NewSlip, user: WorkflowUser): Promise<SlipFull> {
    await simulateLatency();
    if (user.role !== "APPLICANT") {
      throw new Error("伝票の起票は「申請者」ロールのみ可能です");
    }
    if (slip.status !== "S00" && slip.status !== "S01") {
      throw new Error("作成時のステータスは S00 / S01 のみです");
    }
    const prefix = slip.slipType === "PROD" ? "SLP" : "SHP";
    const computed = buildDetails(slip.details);
    const draft: SlipFull = {
      ...slip,
      status: "S00",
      slipNo: state.some(row => row.slipNo === slip.slipNo) ? generateSlipNo(prefix) : slip.slipNo,
      requestEmpId: user.empId,
      requester: user.empName,
      department: user.deptName ?? "-",
      ...computed,
      workflow: [],
    };
    const saved = slip.status === "S01"
      ? applyTransition(draft, "apply", user, undefined, nowStamp())
      : draft;
    const nextState = [saved, ...state];
    // 書込み成功後にのみ公開する。失敗時は一覧もメモリも変更しない。
    persist(nextState);
    state = nextState;
    emit();
    return saved;
  },

  /**
   * ワークフロー遷移。遅延後に最新の保存済み伝票を読み直してから
   * applyTransition (canExecute 含む) を適用するため、
   * 同一アクションの同時実行は 2 件目がステータス不一致で失敗する。
   */
  async transition(
    slipNo: string,
    action: ActionId,
    user: WorkflowUser,
    comment?: string,
    extra?: { lots?: Record<number, string>; receipts?: Record<number, number> }
  ): Promise<SlipFull> {
    await simulateLatency();
    const current = state.find((s) => s.slipNo === slipNo);
    if (!current) throw new Error("伝票が見つかりません");
    const updated = applyTransition(current, action, user, comment, nowStamp(), extra);
    const nextState = state.map((s) => (s.slipNo === slipNo ? updated : s));
    persist(nextState);
    state = nextState;
    emit();
    return updated;
  },

  /** 作成中伝票の修正。起票者本人のみ。履歴・番号・ステータスは維持。 */
  async update(slipNo: string, input: NewSlip, user: WorkflowUser): Promise<SlipFull> {
    await simulateLatency();
    const current = state.find((s) => s.slipNo === slipNo);
    if (!current) throw new Error("伝票が見つかりません");
    if (!canEditSlip(current, user)) throw new Error("この伝票は修正できません");
    const computed = buildDetails(input.details);
    const updated: SlipFull = {
      ...current,
      date: input.date,
      partnerId: input.partnerId,
      partner: input.partner,
      remarks: input.remarks,
      fromLocId: input.fromLocId,
      fromLocName: input.fromLocName,
      deliveryAddress: input.deliveryAddress,
      ...computed,
    };
    const nextState = state.map((s) => (s.slipNo === slipNo ? updated : s));
    persist(nextState);
    state = nextState;
    emit();
    return updated;
  },

  reset() {
    state = seed();
    persist(); emit();
  },
};

/** 新規伝票番号採番 */
export function generateSlipNo(prefix: "SLP" | "SHP"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const base = `${prefix}${dateStr}-`;
  let sequence = 1;
  while (state.some(s => s.slipNo === `${base}${String(sequence).padStart(3, "0")}`)) sequence += 1;
  return `${base}${String(sequence).padStart(3, "0")}`;
}
