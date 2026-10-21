namespace ErpApi.Domain;

// =====================================================================
// 列挙型 (JSON では名前の文字列 "CUSTOMER" / "S01" などでやり取り)
// =====================================================================

public enum PartnerType { CUSTOMER, SUPPLIER, BOTH }

public enum SlipType { PROD, SHIP, BOM }

public enum SlipStatusCode
{
    S00, S01,                   // 作成・申請
    A00, A01, A02,              // 承認プロセス
    P00, P01, P02, P03, P04,    // 購買プロセス
    I00,                        // 検収完了
    T01, T02, T03,              // 出庫プロセス
}

// =====================================================================
// マスタ
// =====================================================================

/// <summary>マスタ共通項目</summary>
public abstract class MasterEntity
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Employee : MasterEntity
{
    public string Kana { get; set; } = "";
    public string Dept { get; set; } = "";
    public string Position { get; set; } = "";
    public DateOnly JoinDate { get; set; }
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
}

public sealed class Item : MasterEntity
{
    public string Spec { get; set; } = "";
    public string Category { get; set; } = "";
    public string Unit { get; set; } = "";
    public decimal Price { get; set; }
    public decimal SafetyStock { get; set; }

    /// <summary>既定の保管倉庫コード (フロントの item.warehouse)</summary>
    public string DefaultWarehouseCode { get; set; } = "";

    public List<ItemStock> Stocks { get; set; } = [];
}

public sealed class Warehouse : MasterEntity
{
    public string Type { get; set; } = "";
    public string Address { get; set; } = "";
    public decimal Capacity { get; set; }
    public string Manager { get; set; } = "";

    public List<ItemStock> Stocks { get; set; } = [];
}

/// <summary>
/// 品目 × 倉庫 ごとの在庫数。在庫数の唯一の正 (Single Source of Truth)。
/// Item.stockQty / Warehouse.currentStock はここからの集計値として返す。
/// </summary>
public sealed class ItemStock
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public Item Item { get; set; } = null!;
    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public decimal Quantity { get; set; }
}

public sealed class Partner : MasterEntity
{
    public PartnerType Type { get; set; }
    public string Representative { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
}

// =====================================================================
// 認証
// =====================================================================

public sealed class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Department { get; set; } = "";
    public string Role { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public sealed class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>トークン本体は保存せず SHA-256 ハッシュのみ保存する</summary>
    public string TokenHash { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

// =====================================================================
// 伝票
// =====================================================================

public sealed class Slip
{
    public int Id { get; set; }
    public string SlipNo { get; set; } = "";
    public SlipType SlipType { get; set; }
    public DateOnly Date { get; set; }
    public string Requester { get; set; } = "";
    public string Department { get; set; } = "";
    public string? Approver { get; set; }
    public string? Handler { get; set; }
    public SlipStatusCode Status { get; set; }

    /// <summary>取引先コード</summary>
    public string Partner { get; set; } = "";

    public DateOnly? DeliveryDate { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? Note { get; set; }
    public decimal TotalAmount { get; set; }

    public int CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>楽観的同時実行制御 (同時承認・同時修正の競合検出)</summary>
    public byte[] RowVersion { get; set; } = [];

    public List<SlipLine> Lines { get; set; } = [];
    public List<SlipHistory> Histories { get; set; } = [];
}

/// <summary>伝票明細 (フロントの SlipItem)</summary>
public sealed class SlipLine
{
    public int Id { get; set; }
    public int SlipId { get; set; }
    public int LineNo { get; set; }
    public string ItemCode { get; set; } = "";
    public string ItemName { get; set; } = "";
    public string Spec { get; set; } = "";
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public string? Warehouse { get; set; }
}

public sealed class SlipHistory
{
    public int Id { get; set; }
    public int SlipId { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public string Actor { get; set; } = "";
    public string Action { get; set; } = "";
    public SlipStatusCode StatusFrom { get; set; }
    public SlipStatusCode StatusTo { get; set; }
    public string? Note { get; set; }
}

/// <summary>伝票番号の採番カウンタ (キー例: "PROD-20261021")</summary>
public sealed class SlipSequence
{
    public string Key { get; set; } = "";
    public int LastValue { get; set; }
}
