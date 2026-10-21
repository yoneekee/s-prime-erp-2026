using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Common;

/// <summary>
/// 標準 API レスポンス (フロントの ApiResponse&lt;T&gt; に対応)。
/// フロントの api-client は HTTP ステータスより先に success を見るため、
/// エラー時も含めて全レスポンスをこの形で返す。
/// </summary>
public sealed class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public IReadOnlyList<string>? Errors { get; init; }
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
}

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T data, string? message = null)
        => new() { Success = true, Data = data, Message = message };

    /// <summary>data を持たない成功レスポンス (削除・ログアウトなど)</summary>
    public static ApiResponse<object?> Empty(string? message = null)
        => new() { Success = true, Data = null, Message = message };

    public static ApiResponse<object?> Fail(string message, IReadOnlyList<string>? errors = null)
        => new() { Success = false, Data = null, Message = message, Errors = errors };
}

/// <summary>ページネーションレスポンス (フロントの PaginatedResponse&lt;T&gt; に対応)</summary>
public sealed class PaginatedResponse<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class PagingExtensions
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    /// <summary>並び順を指定済みのクエリをページングして DTO に射影する</summary>
    public static async Task<PaginatedResponse<TOut>> ToPagedAsync<TIn, TOut>(
        this IQueryable<TIn> query,
        int? page,
        int? pageSize,
        Expression<Func<TIn, TOut>> selector,
        CancellationToken ct)
    {
        var p = Math.Max(1, page ?? 1);
        var size = Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize);

        var total = await query.CountAsync(ct);
        var items = await query.Skip((p - 1) * size).Take(size).Select(selector).ToListAsync(ct);

        return new PaginatedResponse<TOut> { Items = items, TotalCount = total, Page = p, PageSize = size };
    }
}
