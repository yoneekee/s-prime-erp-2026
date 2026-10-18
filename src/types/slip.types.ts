/**
 * 伝票関連の型定義
 * C# バックエンドの DTO に対応する TypeScript インターフェース
 */

// 伝票種別
export type SlipType = "PROD" | "SHIP" | "BOM";

// 伝票ステータスコード
export type SlipStatusCode = 
  | "S00" | "S01"           // 作成・申請
  | "A00" | "A01" | "A02"   // 承認プロセス
  | "P00" | "P01" | "P02" | "P03" | "P04"  // 購買プロセス
  | "I00"                   // 検収完了
  | "T01" | "T02" | "T03";  // 出庫プロセス

// 伝票一覧レコード
export interface SlipRecord {
  slipNo: string;
  slipType: SlipType;
  typeName: string;
  date: string;
  requester: string;
  department: string;
  approver: string;
  handler: string;
  status: SlipStatusCode;
  partner: string;
  totalAmount: number;
  itemCount: number;
}

// 伝票詳細情報
export interface SlipDetail extends SlipRecord {
  deliveryDate?: string;
  deliveryAddress?: string;
  note?: string;
  items: SlipItem[];
  history: SlipHistory[];
}

// 伝票明細
export interface SlipItem {
  id: number;
  itemCode: string;
  itemName: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  note?: string;
  warehouse?: string;
}

// 伝票履歴
export interface SlipHistory {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  statusFrom: SlipStatusCode;
  statusTo: SlipStatusCode;
  note?: string;
}

// 伝票 作成リクエスト
export interface CreateSlipRequest {
  slipType: SlipType;
  date: string;
  requester: string;
  department: string;
  partner: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  note?: string;
  items: CreateSlipItemRequest[];
}

// 伝票明細作成リクエスト
export interface CreateSlipItemRequest {
  itemCode: string;
  itemName: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  note?: string;
  warehouse?: string;
}

// 伝票更新リクエスト
export interface UpdateSlipRequest {
  slipNo: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  note?: string;
  items?: CreateSlipItemRequest[];
}

// 伝票 状態変更リクエスト
export interface ChangeSlipStatusRequest {
  slipNo: string;
  newStatus: SlipStatusCode;
  note?: string;
}

// 伝票検索フィルター
export interface SlipSearchFilter {
  slipType?: SlipType;
  status?: SlipStatusCode;
  dateFrom?: string;
  dateTo?: string;
  requester?: string;
  department?: string;
  partner?: string;
  searchText?: string;
  page?: number;
  pageSize?: number;
}
