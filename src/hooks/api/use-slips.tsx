/**
 * 伝票関連の React Query フック
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { slipService } from "@/services";
import type {
  SlipRecord,
  SlipDetail,
  CreateSlipRequest,
  UpdateSlipRequest,
  ChangeSlipStatusRequest,
  SlipSearchFilter,
  PaginatedResponse,
} from "@/types";

// Query keys
export const slipKeys = {
  all: ["slips"] as const,
  lists: () => [...slipKeys.all, "list"] as const,
  list: (filter?: SlipSearchFilter) => [...slipKeys.lists(), filter] as const,
  details: () => [...slipKeys.all, "detail"] as const,
  detail: (slipNo: string) => [...slipKeys.details(), slipNo] as const,
};

// 伝票 一覧照会
export const useSlips = (
  filter?: SlipSearchFilter,
  options?: UseQueryOptions<PaginatedResponse<SlipRecord>>
) => {
  return useQuery({
    queryKey: slipKeys.list(filter),
    queryFn: () => slipService.getSlips(filter),
    ...options,
  });
};

// 伝票 詳細照会
export const useSlipDetail = (
  slipNo: string,
  options?: UseQueryOptions<SlipDetail>
) => {
  return useQuery({
    queryKey: slipKeys.detail(slipNo),
    queryFn: () => slipService.getSlipDetail(slipNo),
    enabled: !!slipNo,
    ...options,
  });
};

// 伝票 作成
export const useCreateSlip = (
  options?: UseMutationOptions<SlipDetail, Error, CreateSlipRequest>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSlipRequest) => slipService.createSlip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
    },
    ...options,
  });
};

// 伝票 修正
export const useUpdateSlip = (
  options?: UseMutationOptions<SlipDetail, Error, UpdateSlipRequest>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSlipRequest) => slipService.updateSlip(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: slipKeys.detail(data.slipNo) });
    },
    ...options,
  });
};

// 伝票 削除
export const useDeleteSlip = (
  options?: UseMutationOptions<void, Error, string>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slipNo: string) => slipService.deleteSlip(slipNo),
    onSuccess: (_, slipNo) => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
      queryClient.removeQueries({ queryKey: slipKeys.detail(slipNo) });
    },
    ...options,
  });
};

// 伝票 状態変更
export const useChangeSlipStatus = (
  options?: UseMutationOptions<SlipDetail, Error, ChangeSlipStatusRequest>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ChangeSlipStatusRequest) => slipService.changeStatus(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: slipKeys.detail(data.slipNo) });
    },
    ...options,
  });
};

// 伝票 承認
export const useApproveSlip = (
  options?: UseMutationOptions<SlipDetail, Error, { slipNo: string; note?: string }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slipNo, note }) => slipService.approveSlip(slipNo, note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: slipKeys.detail(data.slipNo) });
    },
    ...options,
  });
};

// 伝票 差戻
export const useRejectSlip = (
  options?: UseMutationOptions<SlipDetail, Error, { slipNo: string; note?: string }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slipNo, note }) => slipService.rejectSlip(slipNo, note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: slipKeys.detail(data.slipNo) });
    },
    ...options,
  });
};

// 伝票 申請
export const useSubmitSlip = (
  options?: UseMutationOptions<SlipDetail, Error, { slipNo: string; note?: string }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slipNo, note }) => slipService.submitSlip(slipNo, note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: slipKeys.lists() });
      queryClient.invalidateQueries({ queryKey: slipKeys.detail(data.slipNo) });
    },
    ...options,
  });
};
