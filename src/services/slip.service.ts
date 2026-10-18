/**
 * 伝票サービス
 * 伝票関連の API 呼び出し処理
 */

import { apiClient } from "./api-client";
import type {
  SlipRecord,
  SlipDetail,
  CreateSlipRequest,
  UpdateSlipRequest,
  ChangeSlipStatusRequest,
  SlipSearchFilter,
  PaginatedResponse,
} from "@/types";

export const slipService = {
  // 伝票 一覧照会 (ページネーション)
  async getSlips(filter?: SlipSearchFilter): Promise<PaginatedResponse<SlipRecord>> {
    return apiClient.get<PaginatedResponse<SlipRecord>>("/slips", { 
      params: filter as any 
    });
  },

  // 伝票 詳細照会
  async getSlipDetail(slipNo: string): Promise<SlipDetail> {
    return apiClient.get<SlipDetail>(`/slips/${slipNo}`);
  },

  // 伝票 作成
  async createSlip(data: CreateSlipRequest): Promise<SlipDetail> {
    return apiClient.post<SlipDetail>("/slips", data);
  },

  // 伝票 修正
  async updateSlip(data: UpdateSlipRequest): Promise<SlipDetail> {
    return apiClient.put<SlipDetail>(`/slips/${data.slipNo}`, data);
  },

  // 伝票 削除
  async deleteSlip(slipNo: string): Promise<void> {
    return apiClient.delete<void>(`/slips/${slipNo}`);
  },

  // 伝票 状態変更
  async changeStatus(data: ChangeSlipStatusRequest): Promise<SlipDetail> {
    return apiClient.patch<SlipDetail>(`/slips/${data.slipNo}/status`, data);
  },

  // 伝票 承認
  async approveSlip(slipNo: string, note?: string): Promise<SlipDetail> {
    return this.changeStatus({ slipNo, newStatus: "A01", note });
  },

  // 伝票 差戻
  async rejectSlip(slipNo: string, note?: string): Promise<SlipDetail> {
    return this.changeStatus({ slipNo, newStatus: "A02", note });
  },

  // 伝票 申請
  async submitSlip(slipNo: string, note?: string): Promise<SlipDetail> {
    return this.changeStatus({ slipNo, newStatus: "S01", note });
  },
};
