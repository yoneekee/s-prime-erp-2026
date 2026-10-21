using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ErpApi.Common;
using ErpApi.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace ErpApi.Services;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    /// <summary>HS256 の署名鍵。32 バイト以上必須</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 7;
}

public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _opt = options.Value;

    /// <summary>アクセストークン (JWT) を発行。戻り値の ExpiresIn は秒数</summary>
    public (string Token, int ExpiresIn) CreateAccessToken(User user)
    {
        var now = clock.GetUtcNow().UtcDateTime;

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _opt.Issuer,
            Audience = _opt.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.AddMinutes(_opt.AccessTokenMinutes),
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(AppClaims.UserId, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim(AppClaims.Username, user.Username),
                new Claim(AppClaims.Name, user.Name),
                new Claim(AppClaims.Department, user.Department),
                new Claim(AppClaims.Role, user.Role),
            }),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.SigningKey)),
                SecurityAlgorithms.HmacSha256),
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), _opt.AccessTokenMinutes * 60);
    }

    /// <summary>リフレッシュトークンを生成。DB には Hash のみ保存する</summary>
    public static (string Raw, string Hash) CreateRefreshToken()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        return (raw, Hash(raw));
    }

    public static string Hash(string raw)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
}
