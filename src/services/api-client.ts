/**
 * API クライアント
 * C# バックエンドと通信する共通 HTTP クライアント
 */

import { ApiResponse, ApiError } from "@/types";

// 環境変数から API ベース URL を取得
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 30000;

// エラークラス
export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public apiError: ApiError,
    message?: string
  ) {
    super(message || apiError.message);
    this.name = "ApiClientError";
  }
}

// リクエストオプション
export interface RequestOptions extends RequestInit {
  timeout?: number;
  params?: Record<string, string | number | boolean | undefined>;
}

// API クライアントクラス
class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string, timeout: number) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
  }

  // URL にクエリパラメータを追加
  private buildURL(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  // 認証トークンを取得（sessionStorageから）
  private getAuthToken(): string | null {
    return sessionStorage.getItem("auth_token");
  }

  // 共通ヘッダーを構成
  private getHeaders(customHeaders?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...customHeaders,
    };

    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // タイムアウトに対応する fetch
  private async fetchWithTimeout(url: string, options: RequestOptions): Promise<Response> {
    const timeout = options.timeout || this.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  // レスポンス処理
  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");
    
    // JSON レスポンスではない場合
    if (!contentType || !contentType.includes("application/json")) {
      if (!response.ok) {
        throw new ApiClientError(
          response.status,
          {
            code: "NON_JSON_ERROR",
            message: `HTTP ${response.status}: ${response.statusText}`,
          }
        );
      }
      return response.text() as any;
    }

    const apiResponse: ApiResponse<T> = await response.json();

    // バックエンドが success: false を返した場合
    if (!apiResponse.success) {
      throw new ApiClientError(
        response.status,
        {
          code: "API_ERROR",
          message: apiResponse.message || "Unknown error",
          details: apiResponse.errors as any,
        }
      );
    }

    // HTTP エラーステータスコード
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        {
          code: "HTTP_ERROR",
          message: apiResponse.message || `HTTP ${response.status}`,
        }
      );
    }

    return apiResponse.data;
  }

  // GET リクエスト
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: "GET",
      headers: this.getHeaders(options?.headers),
    });
    return this.handleResponse<T>(response);
  }

  // POST リクエスト
  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: "POST",
      headers: this.getHeaders(options?.headers),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  // PUT リクエスト
  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: "PUT",
      headers: this.getHeaders(options?.headers),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  // PATCH リクエスト
  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: "PATCH",
      headers: this.getHeaders(options?.headers),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  // DELETE リクエスト
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildURL(endpoint, options?.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: "DELETE",
      headers: this.getHeaders(options?.headers),
    });
    return this.handleResponse<T>(response);
  }
}

// シングルトンインスタンス
export const apiClient = new ApiClient(API_BASE_URL, API_TIMEOUT);

// ユーティリティ: mock モードか確認
export const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK_DATA === "true";
};
