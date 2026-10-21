namespace ErpApi.Domain;

// ※ ステータス・種別などのコード値は、フロント (workflow.ts / constants.ts) と同じ文字列で保持する

public interface IAuditable
{
    DateTimeOffset? CreatedAt { get; set; }
    DateTimeOffset? UpdatedAt { get; set; }
}

public interface IMasterEntity : IAuditable
{
    bool IsActive { get; set; }
}

// =====================================================================
// マスタ (mock-data.ts の MockEmployee / MockItem / MockLocation / MockPartner)
// =====================================================================

/// <summary>社員。ログインユーザーを兼ねる (loginId でログイン)</summary>
public sealed class Employee : IMasterEntity
{
    public int EmpId { get; set; }
    public string LoginId { get; set; } = "";
    public string EmpName { get; set; } = "";
    public string DeptCode { get; set; } = "";
    /// <summary>権限種別 (APPROVER / PROD / INSP / LOG)。表示用の社員属性</summary>
    public string RoleType { get; set; } = "";
    public string Email { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string Remarks { get; set; } = "";
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    /// <summary>ワークフローロールの割当 (1 人に複数可)</summary>
    public List<EmployeeRole> WorkflowRoles { get; set; } = [];
}

/// <summary>社員 × ワークフローロール (APPLICANT / APPROVER_1 / ...)</summary>
public sealed class EmployeeRole
{
    public int EmpId { get; set; }
    public string Role { get; set; } = "";
}

/// <summary>ログイン用パスワード (社員マスタとは分離)</summary>
public sealed class UserCredential
{
    public int EmpId { get; set; }
    public string PasswordHash { get; set; } = "";
}

public sealed class Item : IMasterEntity
{
    public int ItemId { get; set; }
    public string ItemCode { get; set; } = "";
    public string ItemName { get; set; } = "";
    /// <summary>RAW / SEMI / FIN</summary>
    public string ItemType { get; set; } = "";
    public string Spec { get; set; } = "";
    public string Unit { get; set; } = "";
    public decimal StdPrice { get; set; }
    public int PlanQty { get; set; }
    /// <summary>在庫数量 (同時更新検出のため同時実行トークン)</summary>
    public int StockQty { get; set; }
    public int SafetyStock { get; set; }
    public string AcctCode { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

/// <summary>倉庫拠点</summary>
public sealed class Location : IMasterEntity
{
    public int LocId { get; set; }
    public string LocName { get; set; } = "";
    /// <summary>FACTORY / STORE / TRANSIT / VENDOR</summary>
    public string LocType { get; set; } = "";
    public string PostalCode { get; set; } = "";
    public string Address { get; set; } = "";
    public string ContactInfo { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string Remarks { get; set; } = "";
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

public sealed class Partner : IMasterEntity
{
    public int PartnerId { get; set; }
    public string PartnerCode { get; set; } = "";
    public string PartnerName { get; set; } = "";
    /// <summary>SUPPLIER / CUSTOMER / BOTH</summary>
    public string PartnerType { get; set; } = "";
    public string PostalCode { get; set; } = "";
    public string Address { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

// =====================================================================
// 認証
// =====================================================================

public sealed class RefreshToken
{
    public int Id { get; set; }
    public int EmpId { get; set; }
    /// <summary>トークン本体は保存せず SHA-256 ハッシュのみ保存</summary>
    public string TokenHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

// =====================================================================
// 伝票 (mock-data.ts の MockSlipRecord / mock-store.ts の SlipFull)
// =====================================================================

public sealed class Slip
{
    public int SlipId { get; set; }
    public string SlipNo { get; set; } = "";
    /// <summary>PROD (購買) / SHIP (出庫)</summary>
    public string SlipType { get; set; } = "";
    public DateOnly Date { get; set; }
    public string Status { get; set; } = "";

    public int RequestEmpId { get; set; }
    /// <summary>起票時点の氏名・部署名 (スナップショット)</summary>
    public string Requester { get; set; } = "";
    public string Department { get; set; } = "";

    public int? ApproverId { get; set; }
    public string Approver { get; set; } = "-";
    public int? HandlerId { get; set; }
    public string Handler { get; set; } = "-";

    public int? PartnerId { get; set; }
    /// <summary>取引先名 (スナップショット)。未設定時は "-"</summary>
    public string PartnerName { get; set; } = "-";

    public string Remarks { get; set; } = "";
    public int? FromLocId { get; set; }
    public string FromLocName { get; set; } = "-";
    public string DeliveryAddress { get; set; } = "";

    public decimal TotalAmount { get; set; }
    public int ItemCount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    /// <summary>楽観的同時実行制御 (同一アクションの同時実行などを 409 で検出)</summary>
    public byte[] RowVersion { get; set; } = [];

    public List<SlipDetail> Details { get; set; } = [];
    public List<SlipWorkflowEntry> Workflow { get; set; } = [];
}

/// <summary>伝票明細 (SlipDetailRow)</summary>
public sealed class SlipDetail
{
    public int Id { get; set; }
    public int SlipId { get; set; }
    /// <summary>伝票内の明細番号 (1 から連番)</summary>
    public int DetailId { get; set; }
    public int ItemId { get; set; }
    public string ItemCode { get; set; } = "";
    public string ItemName { get; set; } = "";
    public string Spec { get; set; } = "";
    public string Unit { get; set; } = "";
    public int OrderQty { get; set; }
    public int InboundQty { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SupplyAmount { get; set; }
    public string LotNo { get; set; } = "";
}

/// <summary>ワークフロー履歴 (WorkflowEntry)</summary>
public sealed class SlipWorkflowEntry
{
    public int Id { get; set; }
    public int SlipId { get; set; }
    public Slip Slip { get; set; } = null!;
    public int StepNo { get; set; }
    public string Action { get; set; } = "";
    /// <summary>アクションの表示ラベル (例: 一次承認)</summary>
    public string Status { get; set; } = "";
    public string FromStatus { get; set; } = "";
    public string ToStatus { get; set; } = "";
    public int EmpId { get; set; }
    public string EmpName { get; set; } = "";
    /// <summary>実行時のロール名称 (例: 一次承認者)</summary>
    public string Role { get; set; } = "";
    public string Comment { get; set; } = "-";
    public DateTime ProcAt { get; set; }
}

/// <summary>伝票番号の採番カウンタ (キー例: "SLP20261021")</summary>
public sealed class SlipSequence
{
    public string Key { get; set; } = "";
    public int LastValue { get; set; }
}

// =====================================================================
// 通知 (既読管理)
// =====================================================================

/// <summary>この日時以前の履歴は既読扱い (フロントの erp_notif_read_at)</summary>
public sealed class NotificationState
{
    public int EmpId { get; set; }
    public DateTime ReadAt { get; set; }
}

/// <summary>個別に既読にした履歴キー (フロントの erp_notif_read_keys)</summary>
public sealed class NotificationReadKey
{
    public int EmpId { get; set; }
    public string Key { get; set; } = "";
}
