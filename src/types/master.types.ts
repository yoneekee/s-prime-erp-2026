/**
 * マスタデータ関連の型定義
 * C# バックエンドの DTO に対応する TypeScript インターフェース
 */

// 社員 マスタ
export interface Employee {
  id: number;
  code: string;
  name: string;
  kana: string;
  dept: string;
  position: string;
  joinDate: string;
  email: string;
  phone?: string;
  isActive?: boolean;
}

// 社員 登録・修正リクエスト
export interface EmployeeRequest {
  code: string;
  name: string;
  kana: string;
  dept: string;
  position: string;
  joinDate: string;
  email: string;
  phone?: string;
  isActive?: boolean;
}

// 品目 マスタ
export interface Item {
  id: number;
  code: string;
  name: string;
  spec: string;
  category: string;
  unit: string;
  price: number;
  stockQty: number;
  safetyStock: number;
  warehouse: string;
  isActive?: boolean;
}

// 品目 登録・修正リクエスト
export interface ItemRequest {
  code: string;
  name: string;
  spec: string;
  category: string;
  unit: string;
  price: number;
  stockQty: number;
  safetyStock: number;
  warehouse: string;
  isActive?: boolean;
}

// 倉庫 マスタ
export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  address: string;
  capacity: number;
  currentStock: number;
  manager: string;
  isActive?: boolean;
}

// 倉庫 登録・修正リクエスト
export interface WarehouseRequest {
  code: string;
  name: string;
  type: string;
  address: string;
  capacity: number;
  currentStock: number;
  manager: string;
  isActive?: boolean;
}

// 取引先 マスタ
export interface Partner {
  id: number;
  code: string;
  name: string;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  representative: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  isActive?: boolean;
}

// 取引先 登録・修正リクエスト
export interface PartnerRequest {
  code: string;
  name: string;
  type: "CUSTOMER" | "SUPPLIER" | "BOTH";
  representative: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  isActive?: boolean;
}

// マスタ検索フィルター
export interface MasterSearchFilter {
  searchText?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}
