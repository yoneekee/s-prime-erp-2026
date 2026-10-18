/**
 * マスタデータサービス
 * 社員・品目・倉庫・取引先マスタの API 呼び出し処理
 */

import { apiClient } from "./api-client";
import type {
  Employee,
  EmployeeRequest,
  Item,
  ItemRequest,
  Warehouse,
  WarehouseRequest,
  Partner,
  PartnerRequest,
  MasterSearchFilter,
  PaginatedResponse,
} from "@/types";

// 社員 マスタ サービス
export const employeeService = {
  async getAll(filter?: MasterSearchFilter): Promise<PaginatedResponse<Employee>> {
    return apiClient.get<PaginatedResponse<Employee>>("/employees", { 
      params: filter as any 
    });
  },

  async getById(id: number): Promise<Employee> {
    return apiClient.get<Employee>(`/employees/${id}`);
  },

  async create(data: EmployeeRequest): Promise<Employee> {
    return apiClient.post<Employee>("/employees", data);
  },

  async update(id: number, data: EmployeeRequest): Promise<Employee> {
    return apiClient.put<Employee>(`/employees/${id}`, data);
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete<void>(`/employees/${id}`);
  },
};

// 品目 マスタ サービス
export const itemService = {
  async getAll(filter?: MasterSearchFilter): Promise<PaginatedResponse<Item>> {
    return apiClient.get<PaginatedResponse<Item>>("/items", { 
      params: filter as any 
    });
  },

  async getById(id: number): Promise<Item> {
    return apiClient.get<Item>(`/items/${id}`);
  },

  async getByCode(code: string): Promise<Item> {
    return apiClient.get<Item>(`/items/code/${code}`);
  },

  async create(data: ItemRequest): Promise<Item> {
    return apiClient.post<Item>("/items", data);
  },

  async update(id: number, data: ItemRequest): Promise<Item> {
    return apiClient.put<Item>(`/items/${id}`, data);
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete<void>(`/items/${id}`);
  },

  // 在庫照会
  async getStock(itemCode: string): Promise<{ itemCode: string; quantity: number; warehouse: string }[]> {
    return apiClient.get<{ itemCode: string; quantity: number; warehouse: string }[]>(
      `/items/${itemCode}/stock`
    );
  },
};

// 倉庫 マスタ サービス
export const warehouseService = {
  async getAll(filter?: MasterSearchFilter): Promise<PaginatedResponse<Warehouse>> {
    return apiClient.get<PaginatedResponse<Warehouse>>("/warehouses", { 
      params: filter as any 
    });
  },

  async getById(id: number): Promise<Warehouse> {
    return apiClient.get<Warehouse>(`/warehouses/${id}`);
  },

  async create(data: WarehouseRequest): Promise<Warehouse> {
    return apiClient.post<Warehouse>("/warehouses", data);
  },

  async update(id: number, data: WarehouseRequest): Promise<Warehouse> {
    return apiClient.put<Warehouse>(`/warehouses/${id}`, data);
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete<void>(`/warehouses/${id}`);
  },
};

// 取引先 マスタ サービス
export const partnerService = {
  async getAll(filter?: MasterSearchFilter): Promise<PaginatedResponse<Partner>> {
    return apiClient.get<PaginatedResponse<Partner>>("/partners", { 
      params: filter as any 
    });
  },

  async getById(id: number): Promise<Partner> {
    return apiClient.get<Partner>(`/partners/${id}`);
  },

  async create(data: PartnerRequest): Promise<Partner> {
    return apiClient.post<Partner>("/partners", data);
  },

  async update(id: number, data: PartnerRequest): Promise<Partner> {
    return apiClient.put<Partner>(`/partners/${id}`, data);
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete<void>(`/partners/${id}`);
  },

  // 種別ごとの取引先を取得
  async getByType(type: "CUSTOMER" | "SUPPLIER" | "BOTH"): Promise<Partner[]> {
    return apiClient.get<Partner[]>("/partners", { 
      params: { type } 
    });
  },
};
