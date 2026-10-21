using System.Security.Claims;

namespace ErpApi.Common;

/// <summary>ロール定義 ※実際のロール名に合わせて変更してください</summary>
public static class Roles
{
    public const string Admin = "admin";
    public const string Manager = "manager";
    public const string User = "user";

    /// <summary>伝票の承認・差戻が可能なロール</summary>
    public static readonly IReadOnlySet<string> Approvers =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { Admin, Manager };
}

/// <summary>JWT から復元したログインユーザー</summary>
public sealed record CurrentUser(int Id, string Name, string Department, string Role)
{
    public bool IsAdmin => string.Equals(Role, Roles.Admin, StringComparison.OrdinalIgnoreCase);
    public bool IsApprover => Roles.Approvers.Contains(Role);
}

/// <summary>JWT に入れるクレーム名 (TokenService と共通)</summary>
public static class AppClaims
{
    public const string UserId = "sub";
    public const string Username = "username";
    public const string Name = "name";
    public const string Department = "dept";
    public const string Role = "role";
}

public static class ClaimsPrincipalExtensions
{
    public static CurrentUser ToCurrentUser(this ClaimsPrincipal principal)
    {
        var sub = principal.FindFirst(AppClaims.UserId)?.Value;
        if (!int.TryParse(sub, out var id))
            throw new UnauthorizedException("認証情報が不正です。再度ログインしてください。");

        return new CurrentUser(
            id,
            principal.FindFirst(AppClaims.Name)?.Value ?? "",
            principal.FindFirst(AppClaims.Department)?.Value ?? "",
            principal.FindFirst(AppClaims.Role)?.Value ?? "");
    }
}
