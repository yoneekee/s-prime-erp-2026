/**
 * ============================================================
 * 伝票ワークフロー定義 (workflow.ts)
 * ============================================================
 *
 * 承認・差戻・検収などの状態遷移ルールの Single Source of Truth。
 * React に依存しない純粋 TypeScript モジュール。
 *
 * - canExecute: ボタンの有効/無効と理由ツールチップ
 * - applyTransition: 新しい伝票オブジェクトを返す (store が永続化)
 * - getFlowSteps: StatusFlowStepper 用のステップ状態
 */

import { SLIP_STATUS_CONFIG } from "./slip-utils";
import { DEMO_USERS, type DemoRole } from "./constants";

export type Role = DemoRole;
export type Actor = Role | "REQUESTER";

export type ActionId =
  | "apply" | "approve1" | "approveFinal" | "reject"
  | "startEstimate" | "return" | "startCorrection" | "order" | "inspect"
  | "ship" | "completeShipment" | "confirmSales"
  | "partialReceive" | "receive";

export interface TransitionDef {
  action: ActionId;
  label: string;
  from: string[];
  to: string;
  actor: Actor;
  requiresComment: boolean;
}

export interface WorkflowUser {
  empId: number;
  empName: string;
  deptName?: string;
  role: Role;
  roleLabel: string;
}

export interface WorkflowEntryLike {
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

export interface WorkflowSlip {
  slipNo: string;
  slipType: "PROD" | "SHIP";
  status: string;
  requestEmpId: number;
  approverId: number | null;
  approver: string;
  handlerId: number | null;
  handler: string;
  partnerId?: number | null;
  fromLocId?: number | null;
  details: { detailId: number; lotNo?: string; orderQty?: number; inboundQty?: number; itemCode?: string; unit?: string }[];
  workflow: WorkflowEntryLike[];
}

// ========================================
// 遷移テーブル
// ========================================

const COMMON_TRANSITIONS: TransitionDef[] = [
  { action: "apply", label: "申請", from: ["S00"], to: "S01", actor: "REQUESTER", requiresComment: false },
  { action: "approve1", label: "一次承認", from: ["S01"], to: "A00", actor: "APPROVER_1", requiresComment: false },
  { action: "reject", label: "否認", from: ["S01"], to: "A02", actor: "APPROVER_1", requiresComment: true },
  { action: "approveFinal", label: "最終承認", from: ["A00"], to: "A01", actor: "APPROVER_2", requiresComment: false },
  { action: "reject", label: "否認", from: ["A00"], to: "A02", actor: "APPROVER_2", requiresComment: true },
];

export const TRANSITIONS: Record<"PROD" | "SHIP", TransitionDef[]> = {
  PROD: [
    ...COMMON_TRANSITIONS,
    { action: "startEstimate", label: "見積開始", from: ["A01"], to: "P01", actor: "PURCHASER", requiresComment: false },
    { action: "return", label: "差戻", from: ["A01", "P01"], to: "P00", actor: "PURCHASER", requiresComment: true },
    { action: "startCorrection", label: "修正開始", from: ["P00"], to: "S00", actor: "REQUESTER", requiresComment: false },
    { action: "order", label: "発注確定", from: ["P01"], to: "P02", actor: "PURCHASER", requiresComment: false },
    { action: "partialReceive", label: "分納入庫", from: ["P02", "P03"], to: "P03", actor: "PURCHASER", requiresComment: false },
    { action: "receive", label: "入庫完了", from: ["P03"], to: "P04", actor: "PURCHASER", requiresComment: false },
    { action: "inspect", label: "検収完了", from: ["P04"], to: "I00", actor: "INSPECTOR", requiresComment: false },
  ],
  SHIP: [
    ...COMMON_TRANSITIONS,
    { action: "ship", label: "配送開始（積送）", from: ["A01"], to: "T01", actor: "SHIPPER", requiresComment: false },
    { action: "return", label: "差戻", from: ["A01"], to: "T00", actor: "SHIPPER", requiresComment: true },
    { action: "startCorrection", label: "修正開始", from: ["T00"], to: "S00", actor: "REQUESTER", requiresComment: false },
    { action: "completeShipment", label: "出庫完了", from: ["T01"], to: "T02", actor: "SHIPPER", requiresComment: false },
    { action: "confirmSales", label: "売上確定", from: ["T02"], to: "T03", actor: "SHIPPER", requiresComment: false },
  ],
};

/** (slipType, action, from-status) で遷移を特定する */
export function findTransition(
  slipType: "PROD" | "SHIP",
  action: ActionId,
  status: string
): TransitionDef | undefined {
  return TRANSITIONS[slipType].find((d) => d.action === action && d.from.includes(status));
}

const roleLabelOf = (role: Role): string =>
  DEMO_USERS.find((u) => u.role === role)?.roleLabel ?? role;

// ========================================
// 実行可否チェック
// ========================================

export type CanExecuteResult = { ok: true } | { ok: false; reason: string };

/** 申請前に不足している項目を、画面とストアで同じ順序で案内する。 */
export function getApplyMissing(slip: WorkflowSlip): string[] {
  const missing: string[] = [];
  if (!slip.details.length) missing.push("明細");
  if (!slip.partnerId) missing.push("取引先");
  if (slip.slipType === "SHIP" && !slip.fromLocId) missing.push("出庫元倉庫");
  return missing;
}

export function canExecute(
  slip: WorkflowSlip,
  action: ActionId,
  user: WorkflowUser
): CanExecuteResult {
  const def = findTransition(slip.slipType, action, slip.status);
  if (!def) return { ok: false, reason: "現在のステータスでは実行できません" };
  if (def.actor === "REQUESTER" && user.empId !== slip.requestEmpId) {
    return { ok: false, reason: "この操作は起票者本人のみ実行できます" };
  }
  if (def.actor !== "REQUESTER" && user.role !== def.actor) {
    return { ok: false, reason: `この操作には「${roleLabelOf(def.actor)}」の権限が必要です` };
  }
  if (action === "apply" && user.role !== "APPLICANT") {
    return { ok: false, reason: "この操作には「申請者」の権限が必要です" };
  }
  const missing = action === "apply" ? getApplyMissing(slip) : [];
  if (missing.length > 0) {
    return { ok: false, reason: `申請に必要な項目が未入力です：${missing.join("、")}` };
  }
  if (action === "partialReceive" && !slip.details.some(d => (d.orderQty ?? 0) - (d.inboundQty ?? 0) > 0)) {
    return { ok: false, reason: "未入庫の明細がありません" };
  }
  if (action === "receive" && !slip.details.every(d => d.orderQty !== undefined && d.inboundQty === d.orderQty)) {
    return { ok: false, reason: "全明細の入庫が完了していません" };
  }
  return { ok: true };
}

// ========================================
// 遷移の適用 (新しい伝票を返す。永続化は store の責務)
// ========================================

export function applyTransition<T extends WorkflowSlip>(
  slip: T,
  action: ActionId,
  user: WorkflowUser,
  comment: string | undefined,
  now: string,
  extra?: { lots?: Record<number, string>; receipts?: Record<number, number> }
): T {
  const check = canExecute(slip, action, user);
  if (check.ok === false) throw new Error(check.reason);
  const def = findTransition(slip.slipType, action, slip.status);
  if (!def) throw new Error("現在のステータスでは実行できません");
  if (def.requiresComment && !comment?.trim()) throw new Error("理由を入力してください");

  let details = slip.details;
  if (action === "ship") {
    const lots = extra?.lots ?? {};
    if (!slip.details.every((d) => (lots[d.detailId] ?? "").trim())) {
      throw new Error("LOT番号を入力してください");
    }
    details = slip.details.map((d) => ({ ...d, lotNo: (lots[d.detailId] ?? "").trim() }));
  }

  let historyComment = comment?.trim() || "-";
  if (action === "partialReceive") {
    const receipts = extra?.receipts ?? {};
    const valid = Object.keys(receipts).every(id => slip.details.some(d => d.detailId === Number(id))) &&
      slip.details.every(d => {
        const qty = receipts[d.detailId] ?? 0;
        return Number.isInteger(qty) && qty >= 0 && qty <= (d.orderQty ?? 0) - (d.inboundQty ?? 0);
      });
    if (!valid || !slip.details.some(d => (receipts[d.detailId] ?? 0) > 0)) {
      throw new Error("入庫数量が不正です");
    }
    const receivedRows: string[] = [];
    details = slip.details.map(d => {
      const qty = receipts[d.detailId] ?? 0;
      if (qty === 0) return d;
      const lotNo = (extra?.lots?.[d.detailId] ?? d.lotNo ?? "").trim();
      if (!lotNo) throw new Error("LOT番号を入力してください");
      receivedRows.push(`${d.itemCode ?? ""} ${qty}${d.unit ?? ""}`);
      return { ...d, inboundQty: (d.inboundQty ?? 0) + qty, lotNo };
    });
    historyComment = [comment?.trim(), ...receivedRows].filter(Boolean).join("、");
  }

  const entry: WorkflowEntryLike = {
    stepNo: slip.workflow.length + 1,
    action,
    status: def.label,
    fromStatus: slip.status,
    toStatus: def.to,
    empId: user.empId,
    empName: user.empName,
    role: user.roleLabel,
    comment: historyComment,
    procAt: now,
  };

  const next: T = { ...slip, status: def.to, details, workflow: [...slip.workflow, entry] };
  if (action === "apply") {
    next.approverId = null; next.approver = "-";
    next.handlerId = null; next.handler = "-";
  }
  if (action === "approveFinal" || action === "reject") {
    next.approverId = user.empId; next.approver = user.empName;
  }
  if ((action === "startEstimate" || action === "ship" || action === "return") && next.handlerId == null) {
    next.handlerId = user.empId; next.handler = user.empName;
  }
  return next;
}

// ========================================
// ステッパー用ステップ状態
// ========================================

export interface FlowStep {
  code: string;
  label: string;
  state: "done" | "current" | "upcoming";
}

export interface FlowBranch {
  status: string;
  label: string;
  afterStep: string;
}

export const MAIN_PATHS: Record<"PROD" | "SHIP", string[]> = {
  PROD: ["S00", "S01", "A00", "A01", "P01", "P02", "P03", "P04", "I00"],
  SHIP: ["S00", "S01", "A00", "A01", "T01", "T02", "T03"],
};

const BRANCH_STATUSES = ["A02", "P00", "T00"];

export function getFlowSteps(slip: WorkflowSlip): { steps: FlowStep[]; branch: FlowBranch | null } {
  const main = MAIN_PATHS[slip.slipType];
  const label = (code: string) => SLIP_STATUS_CONFIG[code]?.label ?? code;

  if (BRANCH_STATUSES.includes(slip.status)) {
    const last = slip.workflow[slip.workflow.length - 1];
    const afterStep = last?.fromStatus ?? "S00";
    const idx = main.indexOf(afterStep);
    return {
      steps: main.map((code, i) => ({
        code, label: label(code), state: i <= idx ? "done" : "upcoming",
      })),
      branch: { status: slip.status, label: label(slip.status), afterStep },
    };
  }

  const idx = main.indexOf(slip.status);
  return {
    steps: main.map((code, i) => ({
      code,
      label: label(code),
      state: i < idx ? "done" : i === idx ? "current" : "upcoming",
    })),
    branch: null,
  };
}

// ========================================
// 状態判定
// ========================================

/** 修正可能: 作成中 かつ 起票者本人のみ */
export function canEditSlip(slip: WorkflowSlip, user: WorkflowUser): boolean {
  return slip.status === "S00" && user.empId === slip.requestEmpId;
}

export function isSlipEditable(status: string): boolean {
  return status === "S00";
}

export function isSlipComplete(status: string): boolean {
  return status === "I00" || status === "T03";
}

export function isSlipTerminal(status: string): boolean {
  return status === "A02" || status === "I00" || status === "T03";
}
