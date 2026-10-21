using System.ComponentModel.DataAnnotations;

namespace ErpApi.Dtos;

public sealed class LoginRequest
{
    [Required, StringLength(50)] public string LoginId { get; init; } = "";
    [Required, StringLength(200)] public string Password { get; init; } = "";
}

public sealed class RefreshTokenRequest
{
    [Required] public string RefreshToken { get; init; } = "";
}

/// <summary>デモ用ロール切替 (APPLICANT / APPROVER_1 / ...)</summary>
public sealed class SwitchRoleRequest
{
    [Required, StringLength(20)] public string Role { get; init; } = "";
}

/// <summary>ログインユーザー情報。roles はワークフローロール</summary>
public sealed record AuthUserDto(
    int EmpId, string LoginId, string EmpName, string DeptCode, string DeptName, IReadOnlyList<string> Roles);

/// <summary>expiresIn はアクセストークンの有効秒数</summary>
public sealed record LoginResponse(string Token, string RefreshToken, int ExpiresIn, AuthUserDto User);
