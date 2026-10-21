using System.ComponentModel.DataAnnotations;

namespace ErpApi.Dtos;

public sealed class LoginRequest
{
    [Required, StringLength(100)] public string Username { get; init; } = "";
    [Required, StringLength(200)] public string Password { get; init; } = "";
}

public sealed class RefreshTokenRequest
{
    [Required] public string RefreshToken { get; init; } = "";
}

public sealed record LoginUserDto(int Id, string Username, string Name, string Email, string Department, string Role);

/// <summary>expiresIn はアクセストークンの有効秒数</summary>
public sealed record LoginResponse(string Token, string RefreshToken, LoginUserDto User, int ExpiresIn);
