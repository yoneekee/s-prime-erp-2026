using System.ComponentModel.DataAnnotations;

namespace ErpApi.Dtos;

// =====================================================================
// 伝票 レスポンス (mock-data.ts の MockSlipRecord / mock-store.ts の SlipFull と同じ項目名)
// =====================================================================

/// <summary>伝票一覧用 (明細・履歴なし)</summary>
public class SlipSummaryDto
{
    public string SlipNo { get; init; } = "";
    public string SlipType { get; init; } = "";
    public string TypeName { get; init; } = "";
    public DateOnly Date { get; init; }
    public string Status { get; init; } = "";
    public int RequestEmpId { get; init; }
    public string Requester { get; init; } = "";
    public string Department { get; init; } = "";
    public int? ApproverId { get; init; }
    public string Approver { get; init; } = "-";
    public int? HandlerId { get; init; }
    public string Handler { get; init; } = "-";
    public int? PartnerId { get; init; }
    public string Partner { get; init; } = "-";
    public string Remarks { get; init; } = "";
    public int? FromLocId { get; init; }
    public string FromLocName { get; init; } = "-";
    public string DeliveryAddress { get; init; } = "";
    public decimal TotalAmount { get; init; }
    public int ItemCount { get; init; }
}

/// <summary>伝票詳細 (明細・ワークフロー履歴・実行可能アクション付き)</summary>
public sealed class SlipDto : SlipSummaryDto
{
    public IReadOnlyList<SlipDetailDto> Details { get; init; } = [];
    public IReadOnlyList<WorkflowEntryDto> Workflow { get; init; } = [];

    /// <summary>
    /// 現在のステータスから可能なアクションと、ログインユーザーが実行できるか (enabled) / できない理由 (reason)。
    /// 画面のボタン活性制御・ツールチップに使う (workflow.ts の canExecute 相当)
    /// </summary>
    public IReadOnlyList<AvailableActionDto> AvailableActions { get; init; } = [];
}

public sealed record SlipDetailDto(
    int DetailId, int ItemId, string ItemCode, string ItemName, string Spec, string Unit,
    int OrderQty, int InboundQty, decimal UnitPrice, decimal SupplyAmount, string LotNo);

public sealed record WorkflowEntryDto(
    int StepNo, string Action, string Status, string FromStatus, string ToStatus,
    int EmpId, string EmpName, string Role, string Comment, DateTime ProcAt);

public sealed record AvailableActionDto(
    string Action, string Label, string ToStatus, bool RequiresComment, bool Enabled, string? Reason);

// =====================================================================
// 伝票 リクエスト
// =====================================================================

public sealed class SlipDetailInput
{
    [Required] public int? ItemId { get; init; }
    [Range(1, int.MaxValue)] public int OrderQty { get; init; }

    /// <summary>省略時は品目マスタの標準単価 (stdPrice)</summary>
    [Range(0, 999_999_999_999.0)] public decimal? UnitPrice { get; init; }
}

/// <summary>起票。submit=true で起票と同時に申請 (S01)</summary>
public sealed class CreateSlipRequest
{
    /// <summary>PROD / SHIP</summary>
    [Required, StringLength(8)] public string SlipType { get; init; } = "";
    [Required] public DateOnly? Date { get; init; }
    public int? PartnerId { get; init; }
    [StringLength(1000)] public string? Remarks { get; init; }
    /// <summary>出庫元倉庫 (出庫伝票の申請時に必須)</summary>
    public int? FromLocId { get; init; }
    [StringLength(300)] public string? DeliveryAddress { get; init; }
    public List<SlipDetailInput> Details { get; init; } = [];
    public bool Submit { get; init; }
}

/// <summary>修正 (S00 かつ起票者本人のみ)。明細は全行置き換え</summary>
public sealed class UpdateSlipRequest
{
    [Required] public DateOnly? Date { get; init; }
    public int? PartnerId { get; init; }
    [StringLength(1000)] public string? Remarks { get; init; }
    public int? FromLocId { get; init; }
    [StringLength(300)] public string? DeliveryAddress { get; init; }
    public List<SlipDetailInput> Details { get; init; } = [];
}

/// <summary>ワークフローアクション実行</summary>
public sealed class SlipActionRequest
{
    /// <summary>apply / approve1 / approveFinal / reject / startEstimate / return / startCorrection /
    /// order / partialReceive / receive / inspect / ship / completeShipment / confirmSales</summary>
    [Required, StringLength(30)] public string Action { get; init; } = "";
    [StringLength(1000)] public string? Comment { get; init; }

    /// <summary>明細番号 → LOT 番号 (ship / partialReceive)</summary>
    public Dictionary<int, string>? Lots { get; init; }

    /// <summary>明細番号 → 今回入庫数量 (partialReceive)</summary>
    public Dictionary<int, int>? Receipts { get; init; }
}

public sealed class SlipSearchFilter
{
    public string? SlipType { get; init; }
    /// <summary>カンマ区切りで複数指定可 (例: S01,A00)</summary>
    public string? Status { get; init; }
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public int? PartnerId { get; init; }
    public int? RequestEmpId { get; init; }
    public string? SearchText { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
}

// =====================================================================
// ダッシュボード・通知 (dashboard.ts 相当)
// =====================================================================

public sealed record DashboardSummaryDto(int Pending, int Purchasing, int Shipping, int LowStock);

/// <summary>actions: ログインユーザーが実行できるアクションの表示名</summary>
public sealed record PendingTaskDto(SlipSummaryDto Slip, IReadOnlyList<string> Actions);

/// <summary>key は「伝票番号 + 履歴番号」(dashboard.ts の getRecentActivity と同じ形式)</summary>
public sealed record NotificationDto(
    string Key, string SlipNo, string SlipType, int StepNo, string Action, string Status, string Label,
    string FromStatus, string ToStatus, int EmpId, string EmpName, string Role, string Comment,
    DateTime ProcAt, bool Unread, string Type);

public sealed record NotificationListDto(IReadOnlyList<NotificationDto> Items, int UnreadCount, DateTime ReadAt);

/// <summary>keys 省略時は全件既読</summary>
public sealed class MarkNotificationsReadRequest
{
    public List<string>? Keys { get; init; }
}
