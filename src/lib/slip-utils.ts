/**
 * 伝票（Slip）の状態に関するユーティリティ関数
 * 
 * 使い方:
 *   import { getSlipStatusLabel, getSlipStatusStyle, getSlipFlowSteps } from "@/lib/slip-utils";
 * 
 *   <Badge className={getSlipStatusStyle(status)}>{getSlipStatusLabel(status)}</Badge>
 * 
 * API連携時:
 *   SLIP_STATUS_CONFIG を API レスポンスに置き換えるか、
 *   各関数の内部を API 呼び出しに変更
 */

import { MAIN_PATHS, isSlipEditable as wfIsEditable, isSlipComplete as wfIsComplete } from "./workflow";

// ========================================
// 状態定義（将来APIに置き換え可能）
// ========================================

export interface SlipStatusConfig {
  label: string;      // 日本語ラベル
  style: string;      // Tailwind クラス（Badge用）
  category: "draft" | "pending" | "approved" | "rejected" | "processing" | "complete";
}

/**
 * 伝票ステータスコード → 設定の対応表
 * NOTE: API連携時はこのオブジェクトをサーバーから取得するか動的に構成
 */
export const SLIP_STATUS_CONFIG: Record<string, SlipStatusConfig> = {
  // 共通 - 作成・申請・承認段階
  S00: { label: "作成中", style: "bg-muted text-muted-foreground", category: "draft" },
  S01: { label: "申請中", style: "bg-warning/20 text-warning", category: "pending" },
  A00: { label: "承認中", style: "bg-info/20 text-info", category: "pending" },
  A01: { label: "承認済", style: "bg-success/20 text-success", category: "approved" },
  A02: { label: "否認", style: "bg-destructive/20 text-destructive", category: "rejected" },

  // 購買伝票専用
  P00: { label: "差戻中", style: "bg-warning/20 text-warning", category: "pending" },
  P01: { label: "見積中", style: "bg-info/20 text-info", category: "processing" },
  P02: { label: "発注済", style: "bg-primary/20 text-primary", category: "processing" },
  P03: { label: "分納中", style: "bg-accent/20 text-accent-foreground", category: "processing" },
  P04: { label: "入庫済", style: "bg-success/20 text-success", category: "processing" },
  I00: { label: "検収済", style: "bg-success text-success-foreground", category: "complete" },

  // 出庫伝票専用
  T00: { label: "差戻中", style: "bg-warning/20 text-warning", category: "pending" },
  T01: { label: "積送中", style: "bg-info/20 text-info", category: "processing" },
  T02: { label: "出庫済", style: "bg-primary/20 text-primary", category: "processing" },
  T03: { label: "売上確定", style: "bg-success text-success-foreground", category: "complete" },
};

// ========================================
// 補助関数
// ========================================

/**
 * ステータスコード → 日本語ラベル
 */
export function getSlipStatusLabel(statusCode: string): string {
  return SLIP_STATUS_CONFIG[statusCode]?.label ?? statusCode;
}

/**
 * ステータスコード → Badge スタイルクラス
 */
export function getSlipStatusStyle(statusCode: string): string {
  return SLIP_STATUS_CONFIG[statusCode]?.style ?? "bg-muted text-muted-foreground";
}

/**
 * ステータスコード → カテゴリ (draft, pending, approved, rejected, processing, complete)
 */
export function getSlipStatusCategory(statusCode: string): SlipStatusConfig["category"] {
  return SLIP_STATUS_CONFIG[statusCode]?.category ?? "draft";
}

/**
 * ステータスコード → 設定全体を返す
 */
export function getSlipStatusConfig(statusCode: string): SlipStatusConfig | undefined {
  return SLIP_STATUS_CONFIG[statusCode];
}

// ========================================
// StatusFlowStepper 用のステップ定義
// ========================================

export interface StatusStep {
  code: string;
  label: string;
}

/**
 * 購買伝票の基本フロー
 */
export const PRODUCTION_FLOW_STEPS: StatusStep[] = [
  { code: "S00", label: "作成中" },
  { code: "S01", label: "申請中" },
  { code: "A00", label: "承認中" },
  { code: "A01", label: "承認済" },
  { code: "P01", label: "見積中" },
  { code: "P02", label: "発注済" },
  { code: "P03", label: "分納中" },
  { code: "P04", label: "入庫済" },
  { code: "I00", label: "検収済" },
];

/**
 * 出庫伝票の基本フロー
 */
export const SHIPMENT_FLOW_STEPS: StatusStep[] = [
  { code: "S00", label: "作成中" },
  { code: "S01", label: "申請中" },
  { code: "A00", label: "承認中" },
  { code: "A01", label: "承認済" },
  { code: "T01", label: "積送中" },
  { code: "T02", label: "出庫済" },
  { code: "T03", label: "売上確定" },
];

/**
 * 伝票種別に応じたフローステップを返す (workflow.ts の MAIN_PATHS に委譲)
 */
export function getSlipFlowSteps(slipType: "PROD" | "SHIP"): StatusStep[] {
  return MAIN_PATHS[slipType].map((code) => ({ code, label: getSlipStatusLabel(code) }));
}

// ========================================
// 状態判定ユーティリティ
// ========================================

/**
 * 完了状態か確認
 */
export function isSlipComplete(statusCode: string): boolean {
  return wfIsComplete(statusCode);
}

/**
 * 編集可能な状態か確認（作成中のみ）
 */
export function isSlipEditable(statusCode: string): boolean {
  return wfIsEditable(statusCode);
}

/**
 * 取消・否認状態か確認
 */
export function isSlipRejected(statusCode: string): boolean {
  return getSlipStatusCategory(statusCode) === "rejected";
}

/**
 * 承認待ち状態か確認
 */
export function isSlipPending(statusCode: string): boolean {
  return getSlipStatusCategory(statusCode) === "pending";
}
