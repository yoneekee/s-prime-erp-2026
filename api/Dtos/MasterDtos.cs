using System.ComponentModel.DataAnnotations;
using ErpApi.Domain;

namespace ErpApi.Dtos;

/// <summary>マスタ登録・修正リクエストの共通項目</summary>
public interface IMasterRequest
{
    string Code { get; }
    string Name { get; }
    bool? IsActive { get; }
}

public class MasterSearchFilter
{
    public string? SearchText { get; init; }
    public bool? IsActive { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
}

public sealed class PartnerSearchFilter : MasterSearchFilter
{
    /// <summary>CUSTOMER / SUPPLIER を指定すると BOTH の取引先も含めて返す</summary>
    public PartnerType? Type { get; init; }
}

// ---------------------------------------------------------------- 社員

public sealed record EmployeeDto(
    int Id, string Code, string Name, string Kana, string Dept, string Position,
    DateOnly JoinDate, string Email, string? Phone, bool IsActive);

public sealed class EmployeeRequest : IMasterRequest
{
    [Required, StringLength(50)] public string Code { get; init; } = "";
    [Required, StringLength(200)] public string Name { get; init; } = "";
    [StringLength(200)] public string Kana { get; init; } = "";
    [Required, StringLength(100)] public string Dept { get; init; } = "";
    [StringLength(100)] public string Position { get; init; } = "";
    [Required] public DateOnly? JoinDate { get; init; }
    [Required, EmailAddress, StringLength(256)] public string Email { get; init; } = "";
    [StringLength(30)] public string? Phone { get; init; }
    public bool? IsActive { get; init; }
}

// ---------------------------------------------------------------- 品目

/// <summary>stockQty は全倉庫の在庫合計、warehouse は既定倉庫コード</summary>
public sealed record ItemDto(
    int Id, string Code, string Name, string Spec, string Category, string Unit,
    decimal Price, decimal StockQty, decimal SafetyStock, string Warehouse, bool IsActive);

public sealed class ItemRequest : IMasterRequest
{
    [Required, StringLength(50)] public string Code { get; init; } = "";
    [Required, StringLength(200)] public string Name { get; init; } = "";
    [StringLength(200)] public string Spec { get; init; } = "";
    [StringLength(100)] public string Category { get; init; } = "";
    [Required, StringLength(20)] public string Unit { get; init; } = "";
    [Range(0, 999_999_999_999.0)] public decimal Price { get; init; }

    /// <summary>新規登録時のみ「既定倉庫の初期在庫」として計上。更新時は無視 (在庫は伝票で変動させる)</summary>
    [Range(0, 999_999_999_999.0)] public decimal StockQty { get; init; }

    [Range(0, 999_999_999_999.0)] public decimal SafetyStock { get; init; }

    /// <summary>既定倉庫コード</summary>
    [StringLength(50)] public string Warehouse { get; init; } = "";

    public bool? IsActive { get; init; }
}

/// <summary>GET /items/{itemCode}/stock の 1 行</summary>
public sealed record ItemStockDto(string ItemCode, decimal Quantity, string Warehouse);

// ---------------------------------------------------------------- 倉庫

/// <summary>currentStock は在庫テーブルからの集計値</summary>
public sealed record WarehouseDto(
    int Id, string Code, string Name, string Type, string Address,
    decimal Capacity, decimal CurrentStock, string Manager, bool IsActive);

public sealed class WarehouseRequest : IMasterRequest
{
    [Required, StringLength(50)] public string Code { get; init; } = "";
    [Required, StringLength(200)] public string Name { get; init; } = "";
    [StringLength(50)] public string Type { get; init; } = "";
    [StringLength(300)] public string Address { get; init; } = "";
    [Range(0, 999_999_999_999.0)] public decimal Capacity { get; init; }

    /// <summary>無視されます (在庫から自動集計)</summary>
    public decimal CurrentStock { get; init; }

    [StringLength(100)] public string Manager { get; init; } = "";
    public bool? IsActive { get; init; }
}

// ---------------------------------------------------------------- 取引先

public sealed record PartnerDto(
    int Id, string Code, string Name, PartnerType Type, string Representative,
    string Contact, string Email, string Phone, string Address, bool IsActive);

public sealed class PartnerRequest : IMasterRequest
{
    [Required, StringLength(50)] public string Code { get; init; } = "";
    [Required, StringLength(200)] public string Name { get; init; } = "";
    [Required] public PartnerType? Type { get; init; }
    [StringLength(100)] public string Representative { get; init; } = "";
    [StringLength(100)] public string Contact { get; init; } = "";
    [StringLength(256)] public string Email { get; init; } = "";
    [StringLength(30)] public string Phone { get; init; } = "";
    [StringLength(300)] public string Address { get; init; } = "";
    public bool? IsActive { get; init; }
}
