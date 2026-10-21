using ErpApi.Common;
using ErpApi.Domain;
using static ErpApi.Services.SlipStatuses;
using static ErpApi.Services.WorkflowActions;

namespace ErpApi.Services;

public static class SlipTypes
{
    public const string Prod = "PROD";
    public const string Ship = "SHIP";

    public static bool IsValid(string? type) => type is Prod or Ship;
    public static string Name(string type) => CodeCatalog.Name(CodeCatalog.SlipType, type);
    /// <summary>伝票番号の接頭辞 (mock-store.ts の generateSlipNo と同じ)</summary>
    public static string Prefix(string type) => type == Prod ? "SLP" : "SHP";
}

public static class SlipStatuses
{
    public const string S00 = "S00", S01 = "S01";
    public const string A00 = "A00", A01 = "A01", A02 = "A02";
    public const string P00 = "P00", P01 = "P01", P02 = "P02", P03 = "P03", P04 = "P04", I00 = "I00";
    public const string T00 = "T00", T01 = "T01", T02 = "T02", T03 = "T03";

    /// <summary>終端ステータス (workflow.ts の isSlipTerminal)</summary>
    public static readonly List<string> Terminal = [A02, I00, T03];
}

/// <summary>workflow.ts の ActionId</summary>
public static class WorkflowActions
{
    public const string Apply = "apply";
    public const string Approve1 = "approve1";
    public const string ApproveFinal = "approveFinal";
    public const string Reject = "reject";
    public const string StartEstimate = "startEstimate";
    public const string Return = "return";
    public const string StartCorrection = "startCorrection";
    public const string Order = "order";
    public const string PartialReceive = "partialReceive";
    public const string Receive = "receive";
    public const string Inspect = "inspect";
    public const string Ship = "ship";
    public const string CompleteShipment = "completeShipment";
    public const string ConfirmSales = "confirmSales";
}

public sealed record TransitionDef(string Action, string Label, string[] From, string To, string Actor, bool RequiresComment);

/// <summary>実行可否。StatusCode は不可の場合に返す HTTP ステータス</summary>
public sealed record WorkflowCheck(bool Ok, string? Reason, int StatusCode)
{
    public static readonly WorkflowCheck Success = new(true, null, StatusCodes.Status200OK);
    public static WorkflowCheck Fail(string reason, int statusCode) => new(false, reason, statusCode);
}

/// <summary>
/// 伝票ワークフロー。フロントの src/lib/workflow.ts をそのまま移植したもの。
/// 画面側の判定はボタン制御用、最終判定はこのクラスで行う。
/// ルールを変更する場合は workflow.ts とこのクラスの両方を修正すること。
/// </summary>
public static class SlipWorkflow
{
    private static TransitionDef T(string action, string label, string[] from, string to, string actor, bool requiresComment = false)
        => new(action, label, from, to, actor, requiresComment);

    // ------------------------------------------------------------ 遷移テーブル (workflow.ts の TRANSITIONS)
    // ※ static フィールドは宣言順に初期化されるため Common を先に宣言する

    private static readonly TransitionDef[] Common =
    [
        T(Apply, "申請", [S00], S01, WorkflowRoles.Requester),
        T(Approve1, "一次承認", [S01], A00, WorkflowRoles.Approver1),
        T(Reject, "否認", [S01], A02, WorkflowRoles.Approver1, requiresComment: true),
        T(ApproveFinal, "最終承認", [A00], A01, WorkflowRoles.Approver2),
        T(Reject, "否認", [A00], A02, WorkflowRoles.Approver2, requiresComment: true),
    ];

    public static readonly IReadOnlyDictionary<string, IReadOnlyList<TransitionDef>> Transitions =
        new Dictionary<string, IReadOnlyList<TransitionDef>>
        {
            [SlipTypes.Prod] =
            [
                .. Common,
                T(StartEstimate, "見積開始", [A01], P01, WorkflowRoles.Purchaser),
                T(Return, "差戻", [A01, P01], P00, WorkflowRoles.Purchaser, requiresComment: true),
                T(StartCorrection, "修正開始", [P00], S00, WorkflowRoles.Requester),
                T(Order, "発注確定", [P01], P02, WorkflowRoles.Purchaser),
                T(PartialReceive, "分納入庫", [P02, P03], P03, WorkflowRoles.Purchaser),
                T(Receive, "入庫完了", [P03], P04, WorkflowRoles.Purchaser),
                T(Inspect, "検収完了", [P04], I00, WorkflowRoles.Inspector),
            ],
            [SlipTypes.Ship] =
            [
                .. Common,
                T(Ship, "配送開始（積送）", [A01], T01, WorkflowRoles.Shipper),
                T(Return, "差戻", [A01], T00, WorkflowRoles.Shipper, requiresComment: true),
                T(StartCorrection, "修正開始", [T00], S00, WorkflowRoles.Requester),
                T(CompleteShipment, "出庫完了", [T01], T02, WorkflowRoles.Shipper),
                T(ConfirmSales, "売上確定", [T02], T03, WorkflowRoles.Shipper),
            ],
        };

    public static TransitionDef? Find(string slipType, string action, string status)
        => Transitions.TryGetValue(slipType, out var defs)
            ? defs.FirstOrDefault(d => d.Action == action && d.From.Contains(status))
            : null;

    // ------------------------------------------------------------ 実行可否 (workflow.ts の canExecute)

    /// <summary>申請前に不足している項目 (getApplyMissing)</summary>
    public static List<string> GetApplyMissing(Slip slip)
    {
        var missing = new List<string>();
        if (slip.Details.Count == 0) missing.Add("明細");
        if (slip.PartnerId is null) missing.Add("取引先");
        if (slip.SlipType == SlipTypes.Ship && slip.FromLocId is null) missing.Add("出庫元倉庫");
        return missing;
    }

    public static WorkflowCheck CanExecute(Slip slip, string action, CurrentUser user)
    {
        var def = Find(slip.SlipType, action, slip.Status);
        if (def is null)
            return WorkflowCheck.Fail("現在のステータスでは実行できません", StatusCodes.Status409Conflict);

        if (def.Actor == WorkflowRoles.Requester && user.EmpId != slip.RequestEmpId)
            return WorkflowCheck.Fail("この操作は起票者本人のみ実行できます", StatusCodes.Status403Forbidden);

        if (def.Actor != WorkflowRoles.Requester && !user.HasRole(def.Actor))
            return WorkflowCheck.Fail($"この操作には「{WorkflowRoles.Label(def.Actor)}」の権限が必要です", StatusCodes.Status403Forbidden);

        if (action == Apply && !user.HasRole(WorkflowRoles.Applicant))
            return WorkflowCheck.Fail("この操作には「申請者」の権限が必要です", StatusCodes.Status403Forbidden);

        if (action == Apply)
        {
            var missing = GetApplyMissing(slip);
            if (missing.Count > 0)
                return WorkflowCheck.Fail($"申請に必要な項目が未入力です：{string.Join("、", missing)}", StatusCodes.Status400BadRequest);
        }

        if (action == PartialReceive && !slip.Details.Any(d => d.OrderQty - d.InboundQty > 0))
            return WorkflowCheck.Fail("未入庫の明細がありません", StatusCodes.Status409Conflict);

        if (action == Receive && !slip.Details.All(d => d.InboundQty == d.OrderQty))
            return WorkflowCheck.Fail("全明細の入庫が完了していません", StatusCodes.Status409Conflict);

        return WorkflowCheck.Success;
    }

    /// <summary>現在のステータスから可能なアクション一覧と、ユーザーごとの実行可否</summary>
    public static List<AvailableAction> GetAvailableActions(Slip slip, CurrentUser user)
        => Transitions.TryGetValue(slip.SlipType, out var defs)
            ? defs.Where(d => d.From.Contains(slip.Status))
                  .Select(d => new AvailableAction(d, CanExecute(slip, d.Action, user)))
                  .ToList()
            : [];

    public sealed record AvailableAction(TransitionDef Def, WorkflowCheck Check);

    /// <summary>修正可能: 作成中 かつ 起票者本人のみ (canEditSlip)</summary>
    public static bool CanEdit(Slip slip, CurrentUser user)
        => slip.Status == S00 && user.EmpId == slip.RequestEmpId;

    // ------------------------------------------------------------ 遷移の適用 (workflow.ts の applyTransition)

    /// <summary>
    /// アクションを適用して伝票を更新する (永続化は呼び出し側)。
    /// 入力チェックはすべて変更前に行い、エラー時は伝票を一切変更しない。
    /// </summary>
    public static void Execute(
        Slip slip,
        string action,
        CurrentUser user,
        string? comment,
        DateTime now,
        IReadOnlyDictionary<int, string>? lots,
        IReadOnlyDictionary<int, int>? receipts)
    {
        var check = CanExecute(slip, action, user);
        if (!check.Ok) throw new BusinessException(check.Reason!, check.StatusCode);

        var def = Find(slip.SlipType, action, slip.Status)!;
        var trimmed = comment?.Trim();
        if (def.RequiresComment && string.IsNullOrEmpty(trimmed))
            throw new BusinessException("理由を入力してください");

        var historyComment = string.IsNullOrEmpty(trimmed) ? "-" : trimmed;

        // ---- 配送開始: 全明細の LOT 番号必須
        if (action == Ship)
        {
            if (!slip.Details.All(d => !string.IsNullOrWhiteSpace(lots?.GetValueOrDefault(d.DetailId))))
                throw new BusinessException("LOT番号を入力してください");

            foreach (var d in slip.Details) d.LotNo = lots![d.DetailId].Trim();
        }

        // ---- 分納入庫: 数量チェック → LOT チェック → 反映
        if (action == PartialReceive)
        {
            var map = receipts ?? new Dictionary<int, int>();
            var valid = map.Keys.All(id => slip.Details.Any(d => d.DetailId == id))
                && slip.Details.All(d =>
                {
                    var qty = map.GetValueOrDefault(d.DetailId);
                    return qty >= 0 && qty <= d.OrderQty - d.InboundQty;
                });
            if (!valid || !slip.Details.Any(d => map.GetValueOrDefault(d.DetailId) > 0))
                throw new BusinessException("入庫数量が不正です");

            var plan = slip.Details
                .Where(d => map.GetValueOrDefault(d.DetailId) > 0)
                .Select(d => (Detail: d, Qty: map[d.DetailId], Lot: (lots?.GetValueOrDefault(d.DetailId) ?? d.LotNo ?? "").Trim()))
                .ToList();
            if (plan.Any(p => p.Lot.Length == 0))
                throw new BusinessException("LOT番号を入力してください");

            foreach (var p in plan)
            {
                p.Detail.InboundQty += p.Qty;
                p.Detail.LotNo = p.Lot;
            }

            var receivedRows = plan.Select(p => $"{p.Detail.ItemCode} {p.Qty}{p.Detail.Unit}");
            historyComment = string.Join("、",
                new[] { trimmed }.Where(s => !string.IsNullOrEmpty(s)).Select(s => s!).Concat(receivedRows));
        }

        // ---- 履歴追加・ステータス更新
        slip.Workflow.Add(new SlipWorkflowEntry
        {
            StepNo = slip.Workflow.Count + 1,
            Action = action,
            Status = def.Label,
            FromStatus = slip.Status,
            ToStatus = def.To,
            EmpId = user.EmpId,
            EmpName = user.EmpName,
            Role = WorkflowRoles.Label(def.Actor == WorkflowRoles.Requester ? WorkflowRoles.Applicant : def.Actor),
            Comment = historyComment,
            ProcAt = now,
        });
        slip.Status = def.To;

        // ---- 承認者・処理担当者
        if (action == Apply)
        {
            slip.ApproverId = null; slip.Approver = "-";
            slip.HandlerId = null; slip.Handler = "-";
        }
        if (action is ApproveFinal or Reject)
        {
            slip.ApproverId = user.EmpId; slip.Approver = user.EmpName;
        }
        if ((action is StartEstimate or Ship or Return) && slip.HandlerId is null)
        {
            slip.HandlerId = user.EmpId; slip.Handler = user.EmpName;
        }
    }
}
