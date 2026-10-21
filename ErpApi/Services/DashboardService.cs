using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using ErpApi.Dtos;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Services;

/// <summary>ダッシュボード集計・通知 (フロントの lib/dashboard.ts 相当)</summary>
public sealed class DashboardService(AppDbContext db, TimeProvider clock)
{
    private static readonly List<string> PendingStatuses = [SlipStatuses.S01, SlipStatuses.A00];
    private static readonly List<string> PurchasingStatuses = [SlipStatuses.P01, SlipStatuses.P02, SlipStatuses.P03, SlipStatuses.P04];
    private static readonly List<string> ShippingStatuses = [SlipStatuses.T01, SlipStatuses.T02];

    // ------------------------------------------------------------ ダッシュボード

    /// <summary>getDashboardCounts</summary>
    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var pending = await db.Slips.CountAsync(x => PendingStatuses.Contains(x.Status), ct);
        var purchasing = await db.Slips.CountAsync(x => x.SlipType == SlipTypes.Prod && PurchasingStatuses.Contains(x.Status), ct);
        var shipping = await db.Slips.CountAsync(x => x.SlipType == SlipTypes.Ship && ShippingStatuses.Contains(x.Status), ct);
        var lowStock = await LowStockQuery().CountAsync(ct);
        return new DashboardSummaryDto(pending, purchasing, shipping, lowStock);
    }

    /// <summary>getSafetyStockAlerts: 有効品目で在庫 &lt; 安全在庫、充足率の低い順</summary>
    public async Task<List<ItemDto>> GetLowStockAsync(CancellationToken ct)
        => await LowStockQuery()
            .OrderBy(i => (double)i.StockQty / i.SafetyStock)
            .Select(MasterMappings.ToItemDto)
            .ToListAsync(ct);

    /// <summary>
    /// getPendingTasks: ログインユーザーが実行可能なアクションがある伝票 (日付・伝票番号の降順)。
    /// 判定はワークフロー定義 (SlipWorkflow.CanExecute) に委譲する。
    /// </summary>
    public async Task<List<PendingTaskDto>> GetTasksAsync(CurrentUser user, CancellationToken ct)
    {
        var slips = await db.Slips.AsNoTracking()
            .Include(x => x.Details)
            .Where(x => !SlipStatuses.Terminal.Contains(x.Status))
            .ToListAsync(ct);

        return slips
            .Select(s => new
            {
                Slip = s,
                Actions = SlipWorkflow.Transitions[s.SlipType]
                    .Where(d => SlipWorkflow.CanExecute(s, d.Action, user).Ok)
                    .Select(d => d.Label)
                    .Distinct()
                    .ToList(),
            })
            .Where(t => t.Actions.Count > 0)
            .OrderByDescending(t => t.Slip.Date)
            .ThenByDescending(t => t.Slip.SlipNo, StringComparer.Ordinal)
            .Select(t => new PendingTaskDto(SlipMapping.ToSummary(t.Slip), t.Actions))
            .ToList();
    }

    private IQueryable<Item> LowStockQuery()
        => db.Items.AsNoTracking().Where(i => i.IsActive && i.StockQty < i.SafetyStock);

    // ------------------------------------------------------------ 通知

    /// <summary>
    /// getRecentActivity + isActivityUnread: 全伝票のワークフロー履歴を処理日時の降順で返す。
    /// 既読判定: procAt が既読日時より後 かつ 個別既読キーに含まれない → 未読
    /// </summary>
    public async Task<NotificationListDto> GetNotificationsAsync(CurrentUser user, int? limit, CancellationToken ct)
    {
        var take = Math.Clamp(limit ?? 20, 1, 100);
        var state = await EnsureStateAsync(user.EmpId, ct);
        var readKeys = (await db.NotificationReadKeys
            .Where(k => k.EmpId == user.EmpId)
            .Select(k => k.Key)
            .ToListAsync(ct)).ToHashSet();

        var rows = await db.SlipWorkflowEntries.AsNoTracking()
            .OrderByDescending(e => e.ProcAt)
            .ThenByDescending(e => e.Slip.SlipNo)
            .ThenByDescending(e => e.StepNo)
            .Take(take)
            .Select(e => new
            {
                e.Slip.SlipNo, e.Slip.SlipType, e.StepNo, e.Action, e.Status, e.FromStatus, e.ToStatus,
                e.EmpId, e.EmpName, e.Role, e.Comment, e.ProcAt,
            })
            .ToListAsync(ct);

        var items = rows.Select(r =>
        {
            var key = $"{r.SlipNo}{r.StepNo}";
            return new NotificationDto(
                key, r.SlipNo, r.SlipType, r.StepNo, r.Action, r.Status, r.Status, r.FromStatus, r.ToStatus,
                r.EmpId, r.EmpName, r.Role, r.Comment, r.ProcAt,
                Unread: r.ProcAt > state.ReadAt && !readKeys.Contains(key),
                Type: ActivityType(r.Status));
        }).ToList();

        var afterReadAt = await db.SlipWorkflowEntries.AsNoTracking()
            .Where(e => e.ProcAt > state.ReadAt)
            .Select(e => new { e.Slip.SlipNo, e.StepNo })
            .ToListAsync(ct);
        var unreadCount = afterReadAt.Count(e => !readKeys.Contains($"{e.SlipNo}{e.StepNo}"));

        return new NotificationListDto(items, unreadCount, state.ReadAt);
    }

    /// <summary>既読登録。keys 省略時は全件既読 (既読日時を現在に更新し、個別キーをクリア)</summary>
    public async Task MarkReadAsync(CurrentUser user, IReadOnlyList<string>? keys, CancellationToken ct)
    {
        var state = await EnsureStateAsync(user.EmpId, ct);

        if (keys is null || keys.Count == 0)
        {
            state.ReadAt = clock.LocalNow();
            await db.NotificationReadKeys.Where(k => k.EmpId == user.EmpId).ExecuteDeleteAsync(ct);
        }
        else
        {
            var targets = keys.Where(k => !string.IsNullOrWhiteSpace(k) && k.Length <= 50).Distinct().ToList();
            var existing = await db.NotificationReadKeys
                .Where(k => k.EmpId == user.EmpId && targets.Contains(k.Key))
                .Select(k => k.Key)
                .ToListAsync(ct);

            foreach (var key in targets.Except(existing))
                db.NotificationReadKeys.Add(new NotificationReadKey { EmpId = user.EmpId, Key = key });
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>初回アクセス時は「現在までを既読」として作成 (フロントのログイン時の動作と同じ)</summary>
    private async Task<NotificationState> EnsureStateAsync(int empId, CancellationToken ct)
    {
        var state = await db.NotificationStates.FirstOrDefaultAsync(s => s.EmpId == empId, ct);
        if (state is not null) return state;

        state = new NotificationState { EmpId = empId, ReadAt = clock.LocalNow() };
        db.NotificationStates.Add(state);
        try
        {
            await db.SaveChangesAsync(ct);
            return state;
        }
        catch (DbUpdateException)
        {
            // 同時アクセスで先に作成された場合は読み直す
            db.Entry(state).State = EntityState.Detached;
            return await db.NotificationStates.FirstAsync(s => s.EmpId == empId, ct);
        }
    }

    /// <summary>getActivityType</summary>
    private static string ActivityType(string label) => label switch
    {
        "否認" or "差戻" => "warning",
        "最終承認" or "検収完了" or "売上確定" => "success",
        _ => "info",
    };
}
