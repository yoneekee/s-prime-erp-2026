using System.Linq.Expressions;
using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using ErpApi.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ErpApi.Services;

/// <summary>伝票の照会・起票・修正・ワークフロー実行 (mock-store.ts の slipStore 相当)</summary>
public sealed class SlipService(
    AppDbContext db,
    SlipNumberGenerator numbers,
    TimeProvider clock,
    IOptions<InventoryOptions> inventory)
{
    // ------------------------------------------------------------ 照会

    public async Task<PaginatedResponse<SlipSummaryDto>> SearchAsync(SlipSearchFilter f, CancellationToken ct)
    {
        var q = db.Slips.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(f.SlipType))
        {
            var type = f.SlipType.Trim();
            q = q.Where(x => x.SlipType == type);
        }
        if (!string.IsNullOrWhiteSpace(f.Status))
        {
            var statuses = f.Status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            q = q.Where(x => statuses.Contains(x.Status));
        }
        if (f.DateFrom is { } from) q = q.Where(x => x.Date >= from);
        if (f.DateTo is { } to) q = q.Where(x => x.Date <= to);
        if (f.PartnerId is { } partnerId) q = q.Where(x => x.PartnerId == partnerId);
        if (f.RequestEmpId is { } requestEmpId) q = q.Where(x => x.RequestEmpId == requestEmpId);
        if (!string.IsNullOrWhiteSpace(f.SearchText))
        {
            var s = f.SearchText.Trim();
            q = q.Where(x => x.SlipNo.Contains(s)
                          || x.PartnerName.Contains(s)
                          || x.Requester.Contains(s)
                          || x.Remarks.Contains(s)
                          || x.Details.Any(d => d.ItemCode.Contains(s) || d.ItemName.Contains(s)));
        }

        return await q
            .OrderByDescending(x => x.Date).ThenByDescending(x => x.SlipNo)
            .ToPagedAsync(f.Page, f.PageSize, SlipMapping.ToSummaryExpr, ct);
    }

    public async Task<SlipDto> GetAsync(string slipNo, CurrentUser user, CancellationToken ct)
        => SlipMapping.ToDto(await LoadAsync(slipNo, tracking: false, ct), user);

    // ------------------------------------------------------------ 起票・修正

    /// <summary>起票 (S00 一時保存 / submit=true で申請まで)。起票は申請者ロールのみ</summary>
    public async Task<SlipDto> CreateAsync(CreateSlipRequest req, CurrentUser user, CancellationToken ct)
    {
        if (!user.HasRole(WorkflowRoles.Applicant))
            throw new ForbiddenException("伝票の起票は「申請者」ロールのみ可能です");

        var type = req.SlipType.Trim().ToUpperInvariant();
        if (!SlipTypes.IsValid(type))
            throw new BusinessException($"伝票種別が不正です: {req.SlipType}");

        var utcNow = clock.GetUtcNow();
        var slip = new Slip
        {
            SlipType = type,
            Date = req.Date!.Value,
            Status = SlipStatuses.S00,
            // 起票者はログインユーザーで確定 (なりすまし防止)
            RequestEmpId = user.EmpId,
            Requester = user.EmpName,
            Department = user.DeptName,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };
        await ApplyHeaderAsync(slip, req.PartnerId, req.FromLocId, req.Remarks, req.DeliveryAddress, ct);
        await ReplaceDetailsAsync(slip, req.Details, ct);

        // 申請チェックは採番前に行う (エラー時に番号を消費しない)
        if (req.Submit)
            SlipWorkflow.Execute(slip, WorkflowActions.Apply, user, null, clock.LocalNow(), null, null);

        slip.SlipNo = await numbers.NextAsync(type, ct);
        db.Slips.Add(slip);
        await db.SaveChangesAsync(ct);

        return SlipMapping.ToDto(slip, user);
    }

    /// <summary>作成中伝票の修正。起票者本人のみ。番号・ステータス・履歴は維持</summary>
    public async Task<SlipDto> UpdateAsync(string slipNo, UpdateSlipRequest req, CurrentUser user, CancellationToken ct)
    {
        var slip = await LoadAsync(slipNo, tracking: true, ct);
        if (slip.Status != SlipStatuses.S00)
            throw new ConflictException("この伝票は修正できません（作成中の伝票のみ修正可能です）");
        if (!SlipWorkflow.CanEdit(slip, user))
            throw new ForbiddenException("この伝票は修正できません（起票者本人のみ修正可能です）");

        slip.Date = req.Date!.Value;
        await ApplyHeaderAsync(slip, req.PartnerId, req.FromLocId, req.Remarks, req.DeliveryAddress, ct);
        await ReplaceDetailsAsync(slip, req.Details, ct);
        slip.UpdatedAt = clock.GetUtcNow();

        await db.SaveChangesAsync(ct);
        return SlipMapping.ToDto(slip, user);
    }

    // ------------------------------------------------------------ ワークフロー

    public async Task<SlipDto> ExecuteActionAsync(string slipNo, SlipActionRequest req, CurrentUser user, CancellationToken ct)
    {
        var slip = await LoadAsync(slipNo, tracking: true, ct);
        var action = req.Action.Trim();

        SlipWorkflow.Execute(slip, action, user, req.Comment, clock.LocalNow(), req.Lots, req.Receipts);

        if (inventory.Value.UpdateStockOnWorkflow)
            await ApplyStockChangesAsync(StockDeltas(slip, action, req.Receipts), ct);

        // 分納入庫 (P03→P03) のようにステータスが変わらない場合も行を更新し、同時実行チェックを効かせる
        slip.UpdatedAt = clock.GetUtcNow();

        // 同一アクションの同時実行は RowVersion 不一致 → 409 (ApiExceptionHandler)
        await db.SaveChangesAsync(ct);
        return SlipMapping.ToDto(slip, user);
    }

    // ------------------------------------------------------------ 内部処理

    private async Task<Slip> LoadAsync(string slipNo, bool tracking, CancellationToken ct)
    {
        IQueryable<Slip> q = db.Slips.Include(x => x.Details).Include(x => x.Workflow).AsSplitQuery();
        if (!tracking) q = q.AsNoTracking();

        return await q.FirstOrDefaultAsync(x => x.SlipNo == slipNo, ct)
            ?? throw new NotFoundException("伝票が見つかりません");
    }

    /// <summary>取引先・出庫元倉庫の存在チェックと名称スナップショットの設定</summary>
    private async Task ApplyHeaderAsync(Slip slip, int? partnerId, int? fromLocId, string? remarks, string? deliveryAddress, CancellationToken ct)
    {
        if (partnerId is { } pid)
        {
            var partner = await db.Partners.AsNoTracking().FirstOrDefaultAsync(x => x.PartnerId == pid, ct);
            if (partner is null || !partner.IsActive)
                throw new BusinessException("取引先が存在しないか無効です");

            // 購買は仕入先、出庫は得意先 (BOTH はどちらも可)
            var expected = slip.SlipType == SlipTypes.Prod ? "SUPPLIER" : "CUSTOMER";
            if (partner.PartnerType != expected && partner.PartnerType != "BOTH")
                throw new BusinessException(slip.SlipType == SlipTypes.Prod
                    ? "購買伝票の取引先には仕入先を指定してください"
                    : "出庫伝票の取引先には得意先を指定してください");

            slip.PartnerId = partner.PartnerId;
            slip.PartnerName = partner.PartnerName;
        }
        else
        {
            slip.PartnerId = null;
            slip.PartnerName = "-";
        }

        if (fromLocId is { } lid)
        {
            var loc = await db.Locations.AsNoTracking().FirstOrDefaultAsync(x => x.LocId == lid, ct);
            if (loc is null || !loc.IsActive)
                throw new BusinessException("出庫元倉庫が存在しないか無効です");

            slip.FromLocId = loc.LocId;
            slip.FromLocName = loc.LocName;
        }
        else
        {
            slip.FromLocId = null;
            slip.FromLocName = "-";
        }

        slip.Remarks = remarks?.Trim() ?? "";
        slip.DeliveryAddress = deliveryAddress?.Trim() ?? "";
    }

    /// <summary>
    /// 明細を全行置き換え (mock-store.ts の buildDetails 相当)。
    /// 品目コード・名称・規格・単位は品目マスタから設定し、金額・件数・合計はサーバーで計算する。
    /// </summary>
    private async Task ReplaceDetailsAsync(Slip slip, IReadOnlyList<SlipDetailInput> inputs, CancellationToken ct)
    {
        var ids = inputs.Select(i => i.ItemId!.Value).Distinct().ToList();
        var items = await db.Items.AsNoTracking()
            .Where(i => ids.Contains(i.ItemId))
            .ToDictionaryAsync(i => i.ItemId, ct);

        var invalid = ids.Where(id => !items.TryGetValue(id, out var item) || !item.IsActive).ToList();
        if (invalid.Count > 0)
            throw new BusinessException($"品目が存在しないか無効です (itemId: {string.Join(", ", invalid)})");

        slip.Details.Clear();
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var item = items[input.ItemId!.Value];
            var unitPrice = input.UnitPrice ?? item.StdPrice;

            slip.Details.Add(new SlipDetail
            {
                DetailId = i + 1,
                ItemId = item.ItemId,
                ItemCode = item.ItemCode,
                ItemName = item.ItemName,
                Spec = item.Spec,
                Unit = item.Unit,
                OrderQty = input.OrderQty,
                InboundQty = 0,
                UnitPrice = unitPrice,
                SupplyAmount = input.OrderQty * unitPrice,
                LotNo = "",
            });
        }

        slip.ItemCount = slip.Details.Count;
        slip.TotalAmount = slip.Details.Sum(d => d.SupplyAmount);
    }

    /// <summary>
    /// 在庫変動量【要確認】: 分納入庫で入庫数量を加算、配送開始で出庫数量を減算。
    /// 現状は品目単位の在庫 (stockQty) のみ。倉庫別在庫にする場合はここを拡張する。
    /// </summary>
    private static List<(int ItemId, int Delta)> StockDeltas(Slip slip, string action, IReadOnlyDictionary<int, int>? receipts)
        => action switch
        {
            WorkflowActions.PartialReceive => slip.Details
                .Where(d => (receipts?.GetValueOrDefault(d.DetailId) ?? 0) > 0)
                .Select(d => (d.ItemId, receipts![d.DetailId]))
                .ToList(),
            WorkflowActions.Ship => slip.Details.Select(d => (d.ItemId, -d.OrderQty)).ToList(),
            _ => [],
        };

    private async Task ApplyStockChangesAsync(List<(int ItemId, int Delta)> deltas, CancellationToken ct)
    {
        if (deltas.Count == 0) return;

        var byItem = deltas.GroupBy(d => d.ItemId).ToDictionary(g => g.Key, g => g.Sum(x => x.Delta));
        var ids = byItem.Keys.ToList();
        var items = await db.Items.Where(i => ids.Contains(i.ItemId)).ToListAsync(ct);

        foreach (var item in items)
        {
            var next = item.StockQty + byItem[item.ItemId];
            if (next < 0)
                throw new ConflictException($"在庫が不足しています: {item.ItemCode}（在庫 {item.StockQty}{item.Unit}）");
            item.StockQty = next; // StockQty は同時実行トークン → 同時更新は 409
        }
    }
}

public static class SlipMapping
{
    /// <summary>一覧用の射影 (SQL に変換。typeName のみ最終射影でクライアント評価)</summary>
    public static readonly Expression<Func<Slip, SlipSummaryDto>> ToSummaryExpr = x => new SlipSummaryDto
    {
        SlipNo = x.SlipNo,
        SlipType = x.SlipType,
        TypeName = SlipTypes.Name(x.SlipType),
        Date = x.Date,
        Status = x.Status,
        RequestEmpId = x.RequestEmpId,
        Requester = x.Requester,
        Department = x.Department,
        ApproverId = x.ApproverId,
        Approver = x.Approver,
        HandlerId = x.HandlerId,
        Handler = x.Handler,
        PartnerId = x.PartnerId,
        Partner = x.PartnerName,
        Remarks = x.Remarks,
        FromLocId = x.FromLocId,
        FromLocName = x.FromLocName,
        DeliveryAddress = x.DeliveryAddress,
        TotalAmount = x.TotalAmount,
        ItemCount = x.ItemCount,
    };

    private static readonly Func<Slip, SlipSummaryDto> ToSummaryFunc = ToSummaryExpr.Compile();

    public static SlipSummaryDto ToSummary(Slip slip) => ToSummaryFunc(slip);

    public static SlipDto ToDto(Slip x, CurrentUser user) => new()
    {
        SlipNo = x.SlipNo,
        SlipType = x.SlipType,
        TypeName = SlipTypes.Name(x.SlipType),
        Date = x.Date,
        Status = x.Status,
        RequestEmpId = x.RequestEmpId,
        Requester = x.Requester,
        Department = x.Department,
        ApproverId = x.ApproverId,
        Approver = x.Approver,
        HandlerId = x.HandlerId,
        Handler = x.Handler,
        PartnerId = x.PartnerId,
        Partner = x.PartnerName,
        Remarks = x.Remarks,
        FromLocId = x.FromLocId,
        FromLocName = x.FromLocName,
        DeliveryAddress = x.DeliveryAddress,
        TotalAmount = x.TotalAmount,
        ItemCount = x.ItemCount,
        Details = x.Details
            .OrderBy(d => d.DetailId)
            .Select(d => new SlipDetailDto(d.DetailId, d.ItemId, d.ItemCode, d.ItemName, d.Spec, d.Unit,
                d.OrderQty, d.InboundQty, d.UnitPrice, d.SupplyAmount, d.LotNo))
            .ToList(),
        Workflow = x.Workflow
            .OrderBy(w => w.StepNo)
            .Select(w => new WorkflowEntryDto(w.StepNo, w.Action, w.Status, w.FromStatus, w.ToStatus,
                w.EmpId, w.EmpName, w.Role, w.Comment, w.ProcAt))
            .ToList(),
        AvailableActions = SlipWorkflow.GetAvailableActions(x, user)
            .Select(a => new AvailableActionDto(a.Def.Action, a.Def.Label, a.Def.To, a.Def.RequiresComment, a.Check.Ok, a.Check.Reason))
            .ToList(),
    };
}
