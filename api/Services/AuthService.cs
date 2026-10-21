using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using ErpApi.Dtos;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ErpApi.Services;

public sealed class AuthService(
    AppDbContext db,
    TokenService tokens,
    IPasswordHasher<User> hasher,
    IOptions<JwtOptions> options,
    TimeProvider clock)
{
    private const string InvalidCredentials = "ユーザー名またはパスワードが正しくありません。";
    private const string InvalidRefresh = "セッションの有効期限が切れました。再度ログインしてください。";

    public async Task<LoginResponse> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username, ct);

        if (user is null || !user.IsActive ||
            hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
        {
            throw new UnauthorizedException(InvalidCredentials);
        }

        return await IssueAsync(user, ct);
    }

    /// <summary>
    /// リフレッシュトークンのローテーション。
    /// 使用済み (失効済み) トークンが再提出された場合は盗用とみなし、当該ユーザーの全トークンを失効させる。
    /// </summary>
    public async Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.Include(r => r.User).FirstOrDefaultAsync(r => r.TokenHash == hash, ct)
            ?? throw new UnauthorizedException(InvalidRefresh);

        if (stored.RevokedAt is not null)
        {
            await RevokeAllAsync(stored.UserId, ct);
            throw new UnauthorizedException(InvalidRefresh);
        }

        if (stored.ExpiresAt <= clock.GetUtcNow() || !stored.User.IsActive)
            throw new UnauthorizedException(InvalidRefresh);

        stored.RevokedAt = clock.GetUtcNow();
        return await IssueAsync(stored.User, ct);
    }

    /// <summary>
    /// フロントの logout はリフレッシュトークンを送らないため、ユーザー単位で全失効させる。
    /// (= 他端末のセッションもログアウトされる)
    /// </summary>
    public Task LogoutAsync(int userId, CancellationToken ct) => RevokeAllAsync(userId, ct);

    private async Task RevokeAllAsync(int userId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.RevokedAt, now), ct);
    }

    private async Task<LoginResponse> IssueAsync(User user, CancellationToken ct)
    {
        var (access, expiresIn) = tokens.CreateAccessToken(user);
        var (raw, hash) = TokenService.CreateRefreshToken();
        var now = clock.GetUtcNow();

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(options.Value.RefreshTokenDays),
        });
        await db.SaveChangesAsync(ct);

        return new LoginResponse(
            access,
            raw,
            new LoginUserDto(user.Id, user.Username, user.Name, user.Email, user.Department, user.Role),
            expiresIn);
    }
}
