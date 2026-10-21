using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Common;

/// <summary>業務エラー。Message はそのまま画面に表示される想定。</summary>
public class BusinessException(string message, int statusCode = StatusCodes.Status400BadRequest) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public sealed class NotFoundException(string message) : BusinessException(message, StatusCodes.Status404NotFound);
public sealed class ConflictException(string message) : BusinessException(message, StatusCodes.Status409Conflict);
public sealed class ForbiddenException(string message) : BusinessException(message, StatusCodes.Status403Forbidden);
public sealed class UnauthorizedException(string message) : BusinessException(message, StatusCodes.Status401Unauthorized);

/// <summary>
/// 全例外を ApiResponse 形式 ({ success: false, message, errors }) に変換する。
/// これがないと ASP.NET Core 既定の ProblemDetails が返り、フロントでは "Unknown error" になる。
/// </summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IHostEnvironment env) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, message) = exception switch
        {
            BusinessException be => (be.StatusCode, be.Message),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict,
                "他のユーザーによって更新されています。画面を再読み込みしてください。"),
            BadHttpRequestException bad => (bad.StatusCode, "リクエストの形式が正しくありません。"),
            _ => (StatusCodes.Status500InternalServerError, "サーバーエラーが発生しました。"),
        };

        if (status >= 500)
        {
            logger.LogError(exception, "Unhandled exception: {Method} {Path}",
                httpContext.Request.Method, httpContext.Request.Path);
        }

        // 開発環境のみ 500 エラーの詳細を返す
        string[]? errors = status >= 500 && env.IsDevelopment() ? new[] { exception.ToString() } : null;

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(ApiResponse.Fail(message, errors), cancellationToken);
        return true;
    }
}
