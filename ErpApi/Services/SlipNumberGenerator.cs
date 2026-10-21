using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Services;

/// <summary>
/// 伝票番号の採番 (mock-store.ts の generateSlipNo と同じ形式)。
/// 形式: {SLP|SHP}{yyyyMMdd}-{3桁連番}  例) SLP20261021-001  ※日付は採番日
/// 同時採番は SlipSequence.LastValue の同時実行トークンで検出してリトライする。
/// ※ 内部で SaveChanges するため、伝票を Add する前に呼ぶこと
/// </summary>
public sealed class SlipNumberGenerator(AppDbContext db, TimeProvider clock)
{
    private const int MaxRetry = 5;

    public async Task<string> NextAsync(string slipType, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.LocalNow());
        var key = $"{SlipTypes.Prefix(slipType)}{today:yyyyMMdd}";

        for (var attempt = 0; attempt < MaxRetry; attempt++)
        {
            var seq = await db.SlipSequences.FirstOrDefaultAsync(s => s.Key == key, ct);
            if (seq is null)
            {
                seq = new SlipSequence { Key = key, LastValue = 1 };
                db.SlipSequences.Add(seq);
            }
            else
            {
                seq.LastValue++;
            }

            try
            {
                await db.SaveChangesAsync(ct);
                return $"{key}-{seq.LastValue:D3}";
            }
            catch (DbUpdateException)
            {
                // 他リクエストと競合 → 読み直して再試行
                db.Entry(seq).State = EntityState.Detached;
            }
        }

        throw new ConflictException("伝票番号の採番に失敗しました。時間をおいて再度お試しください。");
    }
}
