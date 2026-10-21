using System.Security.Claims;

namespace ErpApi.Common;

/// <summary>JWT に入れるクレーム名 (TokenService と共通)</summary>
public static class AppClaims
{
    public const string EmpId = "sub";
    public const string LoginId = "login_id";
    public const string Name = "name";
    public const string DeptCode = "dept";
    /// <summary>ワークフローロール。複数ロールを持つ場合は複数クレームになる</summary>
    public const string Role = "role";
}

/// <summary>JWT から復元したログインユーザー (= 社員)。workflow.ts の WorkflowUser に相当</summary>
public sealed record CurrentUser(int EmpId, string LoginId, string EmpName, string DeptCode, IReadOnlyList<string> Roles)
{
    public string DeptName => CodeCatalog.Name(CodeCatalog.Dept, DeptCode);
    public bool HasRole(string role) => Roles.Contains(role);
}

public static class ClaimsPrincipalExtensions
{
    public static CurrentUser ToCurrentUser(this ClaimsPrincipal principal)
    {
        if (!int.TryParse(principal.FindFirst(AppClaims.EmpId)?.Value, out var empId))
            throw new UnauthorizedException("認証情報が不正です。再度ログインしてください。");

        return new CurrentUser(
            empId,
            principal.FindFirst(AppClaims.LoginId)?.Value ?? "",
            principal.FindFirst(AppClaims.Name)?.Value ?? "",
            principal.FindFirst(AppClaims.DeptCode)?.Value ?? "",
            principal.FindAll(AppClaims.Role).Select(c => c.Value).ToList());
    }
}
