using ErpApi.Domain;
using static ErpApi.Domain.SlipStatusCode;

namespace ErpApi.Services;

/// <summary>
/// 伝票ステータスの遷移ルール。
/// ※ 各ステータスコードの業務上の意味はフロントの型定義コメントから推測したものです。
///    実際の業務フローに合わせてこのクラスだけを修正すれば、API 全体の挙動が変わるようにしています。
/// </summary>
public static class SlipWorkflow
{
    /// <summary>修正・削除が可能なステータス (作成中・差戻)</summary>
    public static readonly IReadOnlySet<SlipStatusCode> Editable = new HashSet<SlipStatusCode> { S00, A02 };

    /// <summary>承認権限が必要な遷移先 (承認待ち受付・承認・差戻)</summary>
    public static readonly IReadOnlySet<SlipStatusCode> ApprovalTargets = new HashSet<SlipStatusCode> { A00, A01, A02 };

    /// <summary>作成者 (または管理者) のみが行える遷移先 (申請・取下げ)</summary>
    public static readonly IReadOnlySet<SlipStatusCode> RequesterTargets = new HashSet<SlipStatusCode> { S00, S01 };

    /// <summary>全伝票種別に共通の遷移 (申請〜承認)</summary>
    private static readonly Dictionary<SlipStatusCode, SlipStatusCode[]> CommonFlow = new()
    {
        [S00] = [S01],                  // 作成 → 申請
        [S01] = [A00, A01, A02, S00],   // 申請 → 承認待ち / 承認 / 差戻 / 取下げ
        [A00] = [A01, A02],             // 承認待ち → 承認 / 差戻
        [A02] = [S01, S00],             // 差戻 → 再申請 / 作成中に戻す
    };

    /// <summary>承認後の遷移 (伝票種別ごと)</summary>
    private static readonly Dictionary<SlipType, Dictionary<SlipStatusCode, SlipStatusCode[]>> PostApprovalFlow = new()
    {
        // 生産: 承認 → 購買プロセス → 検収完了
        [SlipType.PROD] = new()
        {
            [A01] = [P00], [P00] = [P01], [P01] = [P02], [P02] = [P03], [P03] = [P04], [P04] = [I00],
        },
        // 出荷: 承認 → 出庫プロセス
        [SlipType.SHIP] = new()
        {
            [A01] = [T01], [T01] = [T02], [T02] = [T03],
        },
        // BOM: 承認 (A01) で完了
        [SlipType.BOM] = new(),
    };

    public static bool CanTransition(SlipType type, SlipStatusCode from, SlipStatusCode to)
        => (CommonFlow.TryGetValue(from, out var common) && common.Contains(to))
        || (PostApprovalFlow.TryGetValue(type, out var flow) && flow.TryGetValue(from, out var next) && next.Contains(to));

    /// <summary>履歴に記録する操作名</summary>
    public static string ActionName(SlipStatusCode from, SlipStatusCode to) => to switch
    {
        S00 => from == S01 ? "取下げ" : "作成中に戻す",
        S01 => from == A02 ? "再申請" : "申請",
        A00 => "承認待ち",
        A01 => "承認",
        A02 => "差戻",
        I00 => "検収完了",
        P00 or P01 or P02 or P03 or P04 => $"購買処理 ({to})",
        T01 or T02 or T03 => $"出庫処理 ({to})",
        _ => to.ToString(),
    };

    /// <summary>伝票種別の表示名 ※フロントの表示ラベルに合わせて変更してください</summary>
    public static string TypeName(SlipType type) => type switch
    {
        SlipType.PROD => "生産",
        SlipType.SHIP => "出荷",
        SlipType.BOM => "BOM",
        _ => type.ToString(),
    };
}
