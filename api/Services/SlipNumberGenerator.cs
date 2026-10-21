using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Services;

/// <summary>
/// 伝票番号の採番。形式: {種別}-{yyyyMMdd}-{4桁連番}  例) PROD-20261021-0001
/// 同時採番は SlipSequence.LastValue の同時実行トークンで検出し、リトライする。
/// ※ 呼び出し時点で DbContext に他の未保存の変更がないこと (内部で SaveChanges するため)
/// ※ 伝票保存が失敗した場合は欠番になる (欠番を許容しない運用なら同一トランザクションに含める)
/// </summary>
public sealed class SlipNumberGenerator(AppDbContext db)
{
    private const int MaxRetry = 5;

    public async Task<string> NextAsync(SlipType type, DateOnly date, CancellationToken ct)
    {
        var key = $"{type}-{date:yyyyMMdd}";

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
                return $"{key}-{seq.LastValue:D4}";
            }
            catch (DbUpdateException)
            {
                // 他リクエストと競合 (同時実行トークン不一致 or キー重複) → 読み直して再試行
                db.Entry(seq).State = EntityState.Detached;
            }
        }

        throw new ConflictException("伝票番号の採番に失敗しました。時間をおいて再度お試しください。");
    }
}
