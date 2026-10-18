/**
 * API 共通レスポンス型
 * C# バックエンドの標準レスポンス構造に対応
 */

// 標準 API レスポンスラッパー
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

// ページネーションレスポンス
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API エラー
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

// 認証関連
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    name: string;
    email: string;
    department: string;
    role: string;
  };
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
