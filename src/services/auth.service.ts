/**
 * 認証サービス
 * ログイン、ログアウト、トークン更新など
 */

import { apiClient } from "./api-client";
import type { LoginRequest, LoginResponse, RefreshTokenRequest } from "@/types";

export const authService = {
  // ログイン
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>("/auth/login", credentials);
    
    // トークンを保存
    if (response.token) {
      sessionStorage.setItem("auth_token", response.token);
      sessionStorage.setItem("refresh_token", response.refreshToken);
      sessionStorage.setItem("user", JSON.stringify(response.user));
    }
    
    return response;
  },

  // ログアウト
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>("/auth/logout");
    } finally {
      // ローカルトークンを必ず削除
      sessionStorage.removeItem("auth_token");
      sessionStorage.removeItem("refresh_token");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("erp_logged_in");
    }
  },

  // トークン更新
  async refreshToken(): Promise<LoginResponse> {
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await apiClient.post<LoginResponse>("/auth/refresh", {
      refreshToken,
    } as RefreshTokenRequest);

    // 新しいトークンを保存
    if (response.token) {
      sessionStorage.setItem("auth_token", response.token);
      sessionStorage.setItem("refresh_token", response.refreshToken);
    }

    return response;
  },

  // 現在のユーザー情報を取得
  async getCurrentUser() {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // トークンの有効性を検証
  isAuthenticated(): boolean {
    return !!sessionStorage.getItem("auth_token");
  },
};
