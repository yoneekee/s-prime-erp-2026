using System.Linq.Expressions;
using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using ErpApi.Dtos;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Services;

public sealed class SlipService(AppDbContext db, SlipNumberGenerator numbers, TimeProvider clock)
{
    // ------------------------------------------------------------ 照会

    public async Task<PaginatedResponse<SlipRecordDto>> SearchAsync(SlipSearchFilter f, CancellationToken ct)
    {
        var q = db.Slips.AsNoTracking();

        if (f.SlipType is { } type) q = q.Where(x => x.SlipType == type);
        if (f.Status is { } status) q = q.Where(x => x.Status == status);
        if (f.DateFrom is { } from) q = q.Where(x => x.Date >= from);
        if (f.DateTo is { } to) q = q.Where(x => x.Date <= to);

        if (!string.IsNullOrWhiteSpace(f.Requester))
        {
            var v = f.Requester.Trim();
            q = q.Where(x => x.Requester.Contains(v));
        }
        if (!string.IsNullOrWhiteSpace(f.Department))
        {
            var v = f.Department.Trim();
            q = q.Where(x => x.Department.Contains(v));
        }
        if (!string.IsNullOrWhiteSpace(f.Partner))
        {
            var v = f.Partner.Trim();
            q = q.Where(x => x.Partner.Contains(v));
        }
        if (!string.IsNullOrWhiteSpace(f.SearchText))
        {
            var s = f.SearchText.Trim();
            q = q.Where(x => x.SlipNo.Contains(s)
                          || x.Partner.Contains(s)
                          || (x.Note != null && x.Note.Contains(s))
                          || x.Lines.Any(l => l.ItemCode.Contains(s) || l.ItemName.Contains(s)));
        }

        return await q
            .OrderByDescending(x => x.Date).ThenByDescending(x => x.SlipNo)
            .ToPagedAsync(f.Page, f.PageSize, SlipMapping.ToRecord, ct);
    }

    public async Task<SlipDetailDto> GetDetailAsync(string slipNo, CancellationToken ct)
        => SlipMapping.ToDetail(await LoadAsync(slipNo, tracking: false, ct));

    // ------------------------------------------------------------ 作成・修正・削除

    public async Task<SlipDetailDto> CreateAsync(CreateSlipRequest req, CurrentUser user, CancellationToken ct)
    {
        await EnsurePartnerAsync(req.Partner, ct);
        var lines = await BuildLinesAsync(req.Items, ct);

        // 採番は伝票を Add する前に行う (内部で SaveChanges するため)
        var slipNo = await numbers.NextAsync(req.SlipType!.Value, req.Date!.Value, ct);
        var now = clock.GetUtcNow();

        var slip = new Slip
        {
            SlipNo = slipNo,
            SlipType = req.SlipType.Value,
            Date = req.Date.Value,
            Requester = user.Name,          // 申請者はログインユーザーで確定 (なりすまし防止)
            Department = user.Department,
            Status = SlipStatusCode.S00,
            Partner = req.Partner.Trim(),
            DeliveryDate = req.DeliveryDate,
            DeliveryAddress = req.DeliveryAddress,
            Note = req.Note,
            CreatedByUserId = user.Id,
            CreatedAt = now,
            UpdatedAt = now,
        };
        ReplaceLines(slip, lines);
        AddHistory(slip, user, "作成", SlipStatusCode.S00, SlipStatusCode.S00, null, now);

        db.Slips.Add(slip);
        await db.SaveChangesAsync(ct);
        return SlipMapping.ToDetail(slip);
    }

    public async Task<SlipDetailDto> UpdateAsync(string slipNo, UpdateSlipRequest req, CurrentUser user, CancellationToken ct)
    {
        EnsureSameSlipNo(slipNo, req.SlipNo);
        var slip = await LoadAsync(slipNo, tracking: true, ct);
        EnsureEditable(slip, user);

        slip.DeliveryDate = req.DeliveryDate;
        slip.DeliveryAddress = req.DeliveryAddress;
        slip.Note = req.Note;

        if (req.Items is not null)
            ReplaceLines(slip, await BuildLinesAsync(req.Items, ct));

        var now = clock.GetUtcNow();
        slip.UpdatedAt = now;
        AddHistory(slip, user, "修正", slip.Status, slip.Status, null, now);

        await db.SaveChangesAsync(ct);
        return SlipMapping.ToDetail(slip);
    }

    public async Task DeleteAsync(string slipNo, CurrentUser user, CancellationToken ct)
    {
        var slip = await LoadAsync(slipNo, tracking: true, ct);
        EnsureEditable(slip, user);
        db.Slips.Remove(slip);
        await db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------ ステータス変更

    public async Task<SlipDetailDto> ChangeStatusAsync(string slipNo, ChangeSlipStatusRequest req, CurrentUser user, CancellationToken ct)
    {
        EnsureSameSlipNo(slipNo, req.SlipNo);
        var slip = await LoadAsync(slipNo, tracking: true, ct);

        var from = slip.Status;
        var to = req.NewStatus!.Value;

        if (!SlipWorkflow.CanTransition(slip.SlipType, from, to))
            throw new ConflictException($"ステータスを {from} から {to} に変更することはできません。");

        if (SlipWorkflow.ApprovalTargets.Contains(to))
        {
            if (!user.IsApprover)
                throw new ForbiddenException("承認・差戻の権限がありません。");
            if (slip.CreatedByUserId == user.Id)
                throw new ForbiddenException("自分が作成した伝票は承認・差戻できません。");
            if (to == SlipStatusCode.A02 && string.IsNullOrWhiteSpace(req.Note))
                throw new BusinessException("差戻理由を入力してください。");

            slip.Approver = user.Name;
        }
        else if (SlipWorkflow.RequesterTargets.Contains(to))
        {
            if (slip.CreatedByUserId != user.Id && !user.IsAdmin)
                throw new ForbiddenException("申請・取下げは作成者のみ可能です。");
        }
        else
        {
            // 購買・検収・出庫の処理担当者
            slip.Handler = user.Name;
        }

        var now = clock.GetUtcNow();
        slip.Status = to;
        slip.UpdatedAt = now;
        AddHistory(slip, user, SlipWorkflow.ActionName(from, to), from, to, req.Note, now);

        // 同時に別ユーザーが承認した場合などは RowVersion 不一致 → 409 (ApiExceptionHandler)
        await db.SaveChangesAsync(ct);
        return SlipMapping.ToDetail(slip);
    }

    // ------------------------------------------------------------ 内部処理

    private async Task<Slip> LoadAsync(string slipNo, bool tracking, CancellationToken ct)
    {
        IQueryable<Slip> q = db.Slips.Include(x => x.Lines).Include(x => x.Histories).AsSplitQuery();
        if (!tracking) q = q.AsNoTracking();

        return await q.FirstOrDefaultAsync(x => x.SlipNo == slipNo, ct)
            ?? throw new NotFoundException($"伝票 {slipNo} が見つかりません。");
    }

    private static void EnsureSameSlipNo(string routeSlipNo, string bodySlipNo)
    {
        if (!string.Equals(routeSlipNo, bodySlipNo, StringComparison.Ordinal))
            throw new BusinessException("URL と本文の伝票番号が一致しません。");
    }

    private static void EnsureEditable(Slip slip, CurrentUser user)
    {
        if (!SlipWorkflow.Editable.Contains(slip.Status))
            throw new ConflictException($"ステータス {slip.Status} の伝票は修正・削除できません。");
        if (slip.CreatedByUserId != user.Id && !user.IsAdmin)
            throw new ForbiddenException("作成者以外は修正・削除できません。");
    }

    private async Task EnsurePartnerAsync(string code, CancellationToken ct)
    {
        var c = code.Trim();
        if (!await db.Partners.AnyAsync(p => p.Code == c && p.IsActive, ct))
            throw new BusinessException($"取引先 {c} が存在しないか無効です。");
    }

    /// <summary>
    /// 明細を組み立てる。品目名・規格・単位は品目マスタの値を正とし、単価はリクエスト値を採用。
    /// 金額はサーバーで計算する (クライアント計算値は信用しない)。
    /// </summary>
    private async Task<List<SlipLine>> BuildLinesAsync(IReadOnlyList<CreateSlipItemRequest> items, CancellationToken ct)
    {
        if (items.Count == 0)
            throw new BusinessException("明細を1行以上入力してください。");

        var itemCodes = items.Select(i => i.ItemCode.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var masters = await db.Items.AsNoTracking()
            .Where(i => itemCodes.Contains(i.Code))
            .ToDictionaryAsync(i => i.Code, StringComparer.OrdinalIgnoreCase, ct);

        var invalidItems = itemCodes.Where(c => !masters.TryGetValue(c, out var m) || !m.IsActive).ToList();
        if (invalidItems.Count > 0)
            throw new BusinessException($"品目が存在しないか無効です: {string.Join(", ", invalidItems)}");

        var whCodes = items
            .Select(i => i.Warehouse?.Trim())
            .Where(w => !string.IsNullOrEmpty(w))
            .Select(w => w!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (whCodes.Count > 0)
        {
            var existing = await db.Warehouses
                .Where(w => whCodes.Contains(w.Code) && w.IsActive)
                .Select(w => w.Code)
                .ToListAsync(ct);
            var invalidWh = whCodes.Except(existing, StringComparer.OrdinalIgnoreCase).ToList();
            if (invalidWh.Count > 0)
                throw new BusinessException($"倉庫が存在しないか無効です: {string.Join(", ", invalidWh)}");
        }

        return items.Select((r, idx) =>
        {
            var master = masters[r.ItemCode.Trim()];
            return new SlipLine
            {
                LineNo = idx + 1,
                ItemCode = master.Code,
                ItemName = master.Name,
                Spec = master.Spec,
                Unit = master.Unit,
                Quantity = r.Quantity,
                UnitPrice = r.UnitPrice,
                // 円単位で四捨五入 ※自社の端数処理ルールに合わせて変更
                Amount = Math.Round(r.Quantity * r.UnitPrice, 0, MidpointRounding.AwayFromZero),
                Note = r.Note,
                Warehouse = string.IsNullOrWhiteSpace(r.Warehouse) ? null : r.Warehouse.Trim(),
            };
        }).ToList();
    }

    private static void ReplaceLines(Slip slip, List<SlipLine> lines)
    {
        slip.Lines.Clear();         // 既存明細は孤立 → EF が自動削除
        slip.Lines.AddRange(lines);
        slip.TotalAmount = lines.Sum(l => l.Amount);
    }

    private static void AddHistory(Slip slip, CurrentUser user, string action,
        SlipStatusCode from, SlipStatusCode to, string? note, DateTimeOffset now)
    {
        slip.Histories.Add(new SlipHistory
        {
            Timestamp = now,
            Actor = user.Name,
            Action = action,
            StatusFrom = from,
            StatusTo = to,
            Note = note,
        });
    }
}

public static class SlipMapping
{
    /// <summary>一覧用の射影 (SQL に変換される。TypeName のみ最終射影でクライアント評価)</summary>
    public static readonly Expression<Func<Slip, SlipRecordDto>> ToRecord = x => new SlipRecordDto
    {
        SlipNo = x.SlipNo,
        SlipType = x.SlipType,
        TypeName = SlipWorkflow.TypeName(x.SlipType),
        Date = x.Date,
        Requester = x.Requester,
        Department = x.Department,
        Approver = x.Approver ?? "",
        Handler = x.Handler ?? "",
        Status = x.Status,
        Partner = x.Partner,
        TotalAmount = x.TotalAmount,
        ItemCount = x.Lines.Count,
    };

    public static SlipDetailDto ToDetail(Slip x) => new()
    {
        SlipNo = x.SlipNo,
        SlipType = x.SlipType,
        TypeName = SlipWorkflow.TypeName(x.SlipType),
        Date = x.Date,
        Requester = x.Requester,
        Department = x.Department,
        Approver = x.Approver ?? "",
        Handler = x.Handler ?? "",
        Status = x.Status,
        Partner = x.Partner,
        TotalAmount = x.TotalAmount,
        ItemCount = x.Lines.Count,
        DeliveryDate = x.DeliveryDate,
        DeliveryAddress = x.DeliveryAddress,
        Note = x.Note,
        Items = x.Lines
            .OrderBy(l => l.LineNo)
            .Select(l => new SlipItemDto(l.Id, l.ItemCode, l.ItemName, l.Spec, l.Quantity, l.Unit,
                l.UnitPrice, l.Amount, l.Note, l.Warehouse))
            .ToList(),
        History = x.Histories
            .OrderBy(h => h.Timestamp).ThenBy(h => h.Id)
            .Select(h => new SlipHistoryDto(h.Id, h.Timestamp, h.Actor, h.Action, h.StatusFrom, h.StatusTo, h.Note))
            .ToList(),
    };
}
