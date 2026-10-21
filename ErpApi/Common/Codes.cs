namespace ErpApi.Common;

public sealed record CodeItem(string Code, string Name);

/// <summary>
/// 共通コード。フロントの constants.ts / slip-utils.ts と同じ内容。
/// GET /api/codes/{group} で返すほか、DTO の名称項目 (deptName, typeName など) の解決に使う。
/// 将来 DB 管理にする場合はこのクラスの中身だけを差し替える。
/// </summary>
public static class CodeCatalog
{
    public const string Dept = "dept";
    public const string RoleType = "role-type";
    public const string ItemType = "item-type";
    public const string Unit = "unit";
    public const string Account = "account";
    public const string LocationType = "location-type";
    public const string PartnerType = "partner-type";
    public const string SlipType = "slip-type";
    public const string SlipStatus = "slip-status";
    public const string WorkflowRole = "workflow-role";

    private static readonly Dictionary<string, CodeItem[]> Groups = new(StringComparer.OrdinalIgnoreCase)
    {
        [Dept] = C(("MFG1", "製造1課"), ("MFG2", "製造2課"), ("MGT", "経営管理課"), ("LOG", "物流課"), ("QC", "品質管理課"), ("ACC", "経理課")),
        [RoleType] = C(("APPROVER", "承認者"), ("PROD", "製造担当"), ("INSP", "検収担当"), ("LOG", "物流担当")),
        [ItemType] = C(("RAW", "原材料"), ("SEMI", "半製品"), ("FIN", "完成品")),
        [Unit] = C(("EA", "EA"), ("SET", "SET"), ("KG", "KG"), ("BOX", "BOX"), ("L", "L")),
        [Account] = C(("1101", "原材料"), ("1102", "半製品（仕掛品）"), ("1103", "完成品（製品）")),
        [LocationType] = C(("FACTORY", "工場"), ("STORE", "倉庫"), ("TRANSIT", "積送"), ("VENDOR", "取引先")),
        [PartnerType] = C(("SUPPLIER", "仕入先"), ("CUSTOMER", "得意先"), ("BOTH", "仕入先・得意先")),
        [SlipType] = C(("PROD", "購買"), ("SHIP", "出庫")),
        [SlipStatus] = C(
            ("S00", "作成中"), ("S01", "申請中"), ("A00", "承認中"), ("A01", "承認済"), ("A02", "否認"),
            ("P00", "差戻中"), ("P01", "見積中"), ("P02", "発注済"), ("P03", "分納中"), ("P04", "入庫済"), ("I00", "検収済"),
            ("T00", "差戻中"), ("T01", "積送中"), ("T02", "出庫済"), ("T03", "売上確定")),
        [WorkflowRole] = C(
            ("APPLICANT", "申請者"), ("APPROVER_1", "一次承認者"), ("APPROVER_2", "最終承認者"),
            ("PURCHASER", "購買担当"), ("INSPECTOR", "検収担当"), ("SHIPPER", "出庫担当")),
    };

    public static IReadOnlyList<CodeItem>? Get(string group)
        => Groups.TryGetValue(group, out var items) ? items : null;

    public static bool Exists(string group, string? code)
        => code is not null && Groups.TryGetValue(group, out var items) && items.Any(i => i.Code == code);

    /// <summary>コード → 名称 (見つからない場合はコードをそのまま返す)</summary>
    public static string Name(string group, string code)
        => Groups.TryGetValue(group, out var items) ? items.FirstOrDefault(i => i.Code == code)?.Name ?? code : code;

    private static CodeItem[] C(params (string Code, string Name)[] items)
        => items.Select(i => new CodeItem(i.Code, i.Name)).ToArray();
}

/// <summary>ワークフローロール (constants.ts の DEMO_USERS / workflow.ts の Role)</summary>
public static class WorkflowRoles
{
    public const string Applicant = "APPLICANT";
    public const string Approver1 = "APPROVER_1";
    public const string Approver2 = "APPROVER_2";
    public const string Purchaser = "PURCHASER";
    public const string Inspector = "INSPECTOR";
    public const string Shipper = "SHIPPER";

    /// <summary>遷移定義上の「起票者本人」(ロールではなく伝票の requestEmpId で判定)</summary>
    public const string Requester = "REQUESTER";

    public static readonly IReadOnlyList<string> All = [Applicant, Approver1, Approver2, Purchaser, Inspector, Shipper];

    /// <summary>デモ用ロール切替の割当社員 (constants.ts の DEMO_USERS と同じ)</summary>
    public static readonly IReadOnlyDictionary<string, int> DemoEmpIds = new Dictionary<string, int>
    {
        [Applicant] = 1001,
        [Approver1] = 1002,
        [Approver2] = 1003,
        [Purchaser] = 1004,
        [Inspector] = 1006,
        [Shipper] = 1005,
    };

    public static string Label(string role) => CodeCatalog.Name(CodeCatalog.WorkflowRole, role);
}

public static class ClockExtensions
{
    /// <summary>業務日時 (サーバーのローカル時刻・秒単位・タイムゾーン情報なし)。履歴の procAt などに使う</summary>
    public static DateTime LocalNow(this TimeProvider clock)
    {
        var dt = clock.GetLocalNow().DateTime;
        return new DateTime(dt.Ticks - dt.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Unspecified);
    }
}
