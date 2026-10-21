using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ErpApi.Common;
using ErpApi.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace ErpApi.Services;

public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _opt = options.Value;

    /// <summary>アクセストークン (JWT) を発行。ExpiresIn は秒数</summary>
    public (string Token, int ExpiresIn) CreateAccessToken(Employee emp, IEnumerable<string> roles)
    {
        var now = clock.GetUtcNow().UtcDateTime;

        var claims = new List<Claim>
        {
            new(AppClaims.EmpId, emp.EmpId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(AppClaims.LoginId, emp.LoginId),
            new(AppClaims.Name, emp.EmpName),
            new(AppClaims.DeptCode, emp.DeptCode),
        };
        claims.AddRange(roles.Select(r => new Claim(AppClaims.Role, r)));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _opt.Issuer,
            Audience = _opt.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.AddMinutes(_opt.AccessTokenMinutes),
            Subject = new ClaimsIdentity(claims),
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
