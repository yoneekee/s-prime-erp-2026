/**
 * 倉庫 マスタ React Query フック
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { warehouseService } from "@/services";
import type { Warehouse, WarehouseRequest, MasterSearchFilter, PaginatedResponse } from "@/types";

// Query keys
export const warehouseKeys = {
  all: ["warehouses"] as const,
  lists: () => [...warehouseKeys.all, "list"] as const,
  list: (filter?: MasterSearchFilter) => [...warehouseKeys.lists(), filter] as const,
  details: () => [...warehouseKeys.all, "detail"] as const,
  detail: (id: number) => [...warehouseKeys.details(), id] as const,
};

// 倉庫 一覧照会
export const useWarehouses = (
  filter?: MasterSearchFilter,
  options?: UseQueryOptions<PaginatedResponse<Warehouse>>
) => {
  return useQuery({
    queryKey: warehouseKeys.list(filter),
    queryFn: () => warehouseService.getAll(filter),
    ...options,
  });
};

// 倉庫 詳細照会
export const useWarehouse = (
  id: number,
  options?: UseQueryOptions<Warehouse>
) => {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn: () => warehouseService.getById(id),
    enabled: !!id,
    ...options,
  });
};

// 倉庫 作成
export const useCreateWarehouse = (
  options?: UseMutationOptions<Warehouse, Error, WarehouseRequest>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WarehouseRequest) => warehouseService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
    },
    ...options,
  });
};

// 倉庫 修正
export const useUpdateWarehouse = (
  options?: UseMutationOptions<Warehouse, Error, { id: number; data: WarehouseRequest }>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => warehouseService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(id) });
    },
    ...options,
  });
};

// 倉庫 削除
export const useDeleteWarehouse = (
  options?: UseMutationOptions<void, Error, number>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => warehouseService.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      queryClient.removeQueries({ queryKey: warehouseKeys.detail(id) });
    },
    ...options,
  });
};
