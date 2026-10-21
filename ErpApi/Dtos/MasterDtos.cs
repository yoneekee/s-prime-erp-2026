using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using ErpApi.Common;
using ErpApi.Domain;

namespace ErpApi.Dtos;

/// <summary>マスタ登録・修正リクエストの共通項目</summary>
public interface IMasterRequest
{
    bool? IsActive { get; }
}

// ---------------------------------------------------------------- 検索条件

public class MasterSearchFilter
{
    public string? SearchText { get; init; }
    public bool? IsActive { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
}

public sealed class EmployeeSearchFilter : MasterSearchFilter
{
    public string? DeptCode { get; init; }
    public string? RoleType { get; init; }
    /// <summary>ワークフローロールで絞込 (例: APPROVER_1)</summary>
    public string? WorkflowRole { get; init; }
}

public sealed class ItemSearchFilter : MasterSearchFilter
{
    public string? ItemType { get; init; }
}

public sealed class LocationSearchFilter : MasterSearchFilter
{
    public string? LocType { get; init; }
}

public sealed class PartnerSearchFilter : MasterSearchFilter
{
    /// <summary>SUPPLIER / CUSTOMER を指定すると BOTH も含めて返す</summary>
    public string? PartnerType { get; init; }
}

// ---------------------------------------------------------------- 社員 (MockEmployee)

public sealed record EmployeeDto(
    int EmpId, string LoginId, string EmpName, string DeptCode, string DeptName,
    string RoleType, string RoleName, string Email, bool IsActive, string Remarks,
    IReadOnlyList<string> WorkflowRoles);

public sealed class EmployeeRequest : IMasterRequest
{
    [Required, StringLength(50)] public string LoginId { get; init; } = "";
    [Required, StringLength(100)] public string EmpName { get; init; } = "";
    [Required, StringLength(20)] public string DeptCode { get; init; } = "";
    [Required, StringLength(20)] public string RoleType { get; init; } = "";
    [Required, EmailAddress, StringLength(256)] public string Email { get; init; } = "";
    public bool? IsActive { get; init; }
    [StringLength(500)] public string? Remarks { get; init; }

    /// <summary>ワークフローロール。null の場合は変更しない</summary>
    public List<string>? WorkflowRoles { get; init; }
}

// ---------------------------------------------------------------- 品目 (MockItem)

public sealed record ItemDto(
    int ItemId, string ItemCode, string ItemName, string ItemType, string TypeName, string Spec, string Unit,
    decimal StdPrice, int PlanQty, int StockQty, int SafetyStock, string AcctCode, bool IsActive);

public sealed class ItemRequest : IMasterRequest
{
    [Required, StringLength(50)] public string ItemCode { get; init; } = "";
    [Required, StringLength(200)] public string ItemName { get; init; } = "";
    [Required, StringLength(10)] public string ItemType { get; init; } = "";
    [StringLength(200)] public string? Spec { get; init; }
    [Required, StringLength(10)] public string Unit { get; init; } = "";
    [Range(0, 999_999_999_999.0)] public decimal StdPrice { get; init; }
    [Range(0, int.MaxValue)] public int PlanQty { get; init; }
    [Range(0, int.MaxValue)] public int StockQty { get; init; }
    [Range(0, int.MaxValue)] public int SafetyStock { get; init; }
    [Required, StringLength(10)] public string AcctCode { get; init; } = "";
    public bool? IsActive { get; init; }
}

// ---------------------------------------------------------------- 倉庫拠点 (MockLocation)

public sealed record LocationDto(
    int LocId, string LocName, string LocType, string TypeName, string PostalCode,
    string Address, string ContactInfo, bool IsActive, string Remarks);

public sealed class LocationRequest : IMasterRequest
{
    [Required, StringLength(100)] public string LocName { get; init; } = "";
    [Required, StringLength(20)] public string LocType { get; init; } = "";
    [StringLength(10)] public string? PostalCode { get; init; }
    [StringLength(300)] public string? Address { get; init; }
    [StringLength(100)] public string? ContactInfo { get; init; }
    public bool? IsActive { get; init; }
    [StringLength(500)] public string? Remarks { get; init; }
}

// ---------------------------------------------------------------- 取引先 (MockPartner)

public sealed record PartnerDto(
    int PartnerId, string PartnerCode, string PartnerName, string PartnerType,
    string PostalCode, string Address, bool IsActive);

public sealed class PartnerRequest : IMasterRequest
{
    [Required, StringLength(50)] public string PartnerCode { get; init; } = "";
    [Required, StringLength(200)] public string PartnerName { get; init; } = "";
    [Required, StringLength(10)] public string PartnerType { get; init; } = "";
    [StringLength(10)] public string? PostalCode { get; init; }
    [StringLength(300)] public string? Address { get; init; }
    public bool? IsActive { get; init; }
}

// ---------------------------------------------------------------- 射影 (名称はコードから解決)

public static class MasterMappings
{
    public static readonly Expression<Func<Employee, EmployeeDto>> ToEmployeeDto = x => new EmployeeDto(
        x.EmpId, x.LoginId, x.EmpName,
        x.DeptCode, CodeCatalog.Name(CodeCatalog.Dept, x.DeptCode),
        x.RoleType, CodeCatalog.Name(CodeCatalog.RoleType, x.RoleType),
        x.Email, x.IsActive, x.Remarks,
        x.WorkflowRoles.Select(r => r.Role).ToList());

    public static readonly Expression<Func<Item, ItemDto>> ToItemDto = x => new ItemDto(
        x.ItemId, x.ItemCode, x.ItemName,
        x.ItemType, CodeCatalog.Name(CodeCatalog.ItemType, x.ItemType),
        x.Spec, x.Unit, x.StdPrice, x.PlanQty, x.StockQty, x.SafetyStock, x.AcctCode, x.IsActive);

    public static readonly Expression<Func<Location, LocationDto>> ToLocationDto = x => new LocationDto(
        x.LocId, x.LocName,
        x.LocType, CodeCatalog.Name(CodeCatalog.LocationType, x.LocType),
        x.PostalCode, x.Address, x.ContactInfo, x.IsActive, x.Remarks);

    public static readonly Expression<Func<Partner, PartnerDto>> ToPartnerDto = x => new PartnerDto(
        x.PartnerId, x.PartnerCode, x.PartnerName, x.PartnerType, x.PostalCode, x.Address, x.IsActive);
}
