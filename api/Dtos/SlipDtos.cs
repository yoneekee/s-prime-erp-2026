using System.ComponentModel.DataAnnotations;
using ErpApi.Domain;

namespace ErpApi.Dtos;

// ---------------------------------------------------------------- レスポンス

/// <summary>伝票一覧レコード (フロントの SlipRecord)</summary>
public class SlipRecordDto
{
    public string SlipNo { get; init; } = "";
    public SlipType SlipType { get; init; }
    public string TypeName { get; init; } = "";
    public DateOnly Date { get; init; }
    public string Requester { get; init; } = "";
    public string Department { get; init; } = "";
    public string Approver { get; init; } = "";
    public string Handler { get; init; } = "";
    public SlipStatusCode Status { get; init; }
    public string Partner { get; init; } = "";
    public decimal TotalAmount { get; init; }
    public int ItemCount { get; init; }
}

/// <summary>伝票詳細 (フロントの SlipDetail)</summary>
public sealed class SlipDetailDto : SlipRecordDto
{
    public DateOnly? DeliveryDate { get; init; }
    public string? DeliveryAddress { get; init; }
    public string? Note { get; init; }
    public IReadOnlyList<SlipItemDto> Items { get; init; } = [];
    public IReadOnlyList<SlipHistoryDto> History { get; init; } = [];
}

public sealed record SlipItemDto(
    int Id, string ItemCode, string ItemName, string Spec, decimal Quantity, string Unit,
    decimal UnitPrice, decimal Amount, string? Note, string? Warehouse);

public sealed record SlipHistoryDto(
    int Id, DateTimeOffset Timestamp, string Actor, string Action,
    SlipStatusCode StatusFrom, SlipStatusCode StatusTo, string? Note);

// ---------------------------------------------------------------- リクエスト

public sealed class CreateSlipRequest
{
    [Required] public SlipType? SlipType { get; init; }
    [Required] public DateOnly? Date { get; init; }

    /// <summary>無視されます (サーバー側でログインユーザーから設定)</summary>
    public string? Requester { get; init; }

    /// <summary>無視されます (サーバー側でログインユーザーから設定)</summary>
    public string? Department { get; init; }

    /// <summary>取引先コード</summary>
    [Required, StringLength(50)] public string Partner { get; init; } = "";

    public DateOnly? DeliveryDate { get; init; }
    [StringLength(300)] public string? DeliveryAddress { get; init; }
    [StringLength(1000)] public string? Note { get; init; }

    [Required, MinLength(1, ErrorMessage = "明細を1行以上入力してください。")]
    public List<CreateSlipItemRequest> Items { get; init; } = [];
}

public sealed class CreateSlipItemRequest
{
    [Required, StringLength(50)] public string ItemCode { get; init; } = "";

    /// <summary>品目マスタの値で上書きされます</summary>
    public string? ItemName { get; init; }
    /// <summary>品目マスタの値で上書きされます</summary>
    public string? Spec { get; init; }
    /// <summary>品目マスタの値で上書きされます</summary>
    public string? Unit { get; init; }

    [Range(0.0001, 999_999_999.0)] public decimal Quantity { get; init; }
    [Range(0, 999_999_999_999.0)] public decimal UnitPrice { get; init; }
    [StringLength(500)] public string? Note { get; init; }

    /// <summary>倉庫コード</summary>
    [StringLength(50)] public string? Warehouse { get; init; }
}

/// <summary>
/// PUT は「編集可能な項目の全置き換え」。
/// deliveryDate などを省略 (null) すると値がクリアされる。items が null の場合のみ明細は変更しない。
/// </summary>
public sealed class UpdateSlipRequest
{
    [Required] public string SlipNo { get; init; } = "";
    public DateOnly? DeliveryDate { get; init; }
    [StringLength(300)] public string? DeliveryAddress { get; init; }
    [StringLength(1000)] public string? Note { get; init; }
    public List<CreateSlipItemRequest>? Items { get; init; }
}

public sealed class ChangeSlipStatusRequest
{
    [Required] public string SlipNo { get; init; } = "";
    [Required] public SlipStatusCode? NewStatus { get; init; }
    [StringLength(1000)] public string? Note { get; init; }
}

public sealed class SlipSearchFilter
{
    public SlipType? SlipType { get; init; }
    public SlipStatusCode? Status { get; init; }
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public string? Requester { get; init; }
    public string? Department { get; init; }
    public string? Partner { get; init; }
    public string? SearchText { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
}
