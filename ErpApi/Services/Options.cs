namespace ErpApi.Services;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    /// <summary>HS256 の署名鍵。32 バイト以上必須</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 7;
}

/// <summary>デモ機能 (本番では Enabled=false)</summary>
public sealed class DemoOptions
{
    /// <summary>POST /api/auth/demo/switch-role を有効にする</summary>
    public bool Enabled { get; set; }

    /// <summary>開発環境で全社員に設定するパスワード</summary>
    public string Password { get; set; } = "demo1234";
}

/// <summary>在庫連動【要確認】</summary>
public sealed class InventoryOptions
{
    /// <summary>
    /// true: 分納入庫で入庫数量を加算、配送開始で出庫数量を減算 (品目単位の stockQty)。
    /// false: 現行フロントと同じく在庫を変動させない
    /// </summary>
    public bool UpdateStockOnWorkflow { get; set; }
}
