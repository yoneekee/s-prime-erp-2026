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
    IPasswordHasher<Employee> hasher,
    IOptions<JwtOptions> jwt,
    IOptions<DemoOptions> demo,
    TimeProvider clock)
{
    private const string InvalidCredentials = "ログインIDまたはパスワードが正しくありません。";
    private const string InvalidRefresh = "セッションの有効期限が切れました。再度ログインしてください。";

    public async Task<LoginResponse> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var loginId = req.LoginId.Trim();
        var emp = await db.Employees.Include(e => e.WorkflowRoles).FirstOrDefaultAsync(e => e.LoginId == loginId, ct);
        var cred = emp is null ? null : await db.UserCredentials.FirstOrDefaultAsync(c => c.EmpId == emp.EmpId, ct);

        if (emp is null || cred is null || !emp.IsActive ||
            hasher.VerifyHashedPassword(emp, cred.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
        {
            throw new UnauthorizedException(InvalidCredentials);
        }

        return await IssueAsync(emp, ct);
    }

    /// <summary>
    /// リフレッシュトークンのローテーション。
    /// 使用済みトークンが再提出された場合は盗用とみなし、当該ユーザーの全トークンを失効させる。
    /// </summary>
    public async Task<LoginResponse> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash, ct)
            ?? throw new UnauthorizedException(InvalidRefresh);

        if (stored.RevokedAt is not null)
        {
            await RevokeAllAsync(stored.EmpId, ct);
            throw new UnauthorizedException(InvalidRefresh);
        }

        var emp = await db.Employees.Include(e => e.WorkflowRoles).FirstOrDefaultAsync(e => e.EmpId == stored.EmpId, ct);
        if (stored.ExpiresAt <= clock.GetUtcNow() || emp is null || !emp.IsActive)
            throw new UnauthorizedException(InvalidRefresh);

        stored.RevokedAt = clock.GetUtcNow();
        return await IssueAsync(emp, ct);
    }

    /// <summary>フロントの logout はリフレッシュトークンを送らないため、ユーザー単位で全失効させる</summary>
    public Task LogoutAsync(int empId, CancellationToken ct) => RevokeAllAsync(empId, ct);

    public async Task<AuthUserDto> GetMeAsync(int empId, CancellationToken ct)
    {
        var emp = await db.Employees.AsNoTracking().Include(e => e.WorkflowRoles).FirstOrDefaultAsync(e => e.EmpId == empId, ct)
            ?? throw new UnauthorizedException(InvalidRefresh);
        return ToAuthUser(emp);
    }

    /// <summary>
    /// デモ用ロール切替。指定ロールに割り当てられたデモ社員 (DEMO_USERS) としてトークンを再発行する。
    /// Demo:Enabled=false の環境では 404。
    /// </summary>
    public async Task<LoginResponse> SwitchDemoRoleAsync(string role, CancellationToken ct)
    {
        if (!demo.Value.Enabled)
            throw new NotFoundException("この環境ではデモ機能は無効です。");
        if (!WorkflowRoles.DemoEmpIds.TryGetValue(role, out var empId))
            throw new BusinessException($"不明なロールです: {role}");

        var emp = await db.Employees.Include(e => e.WorkflowRoles).FirstOrDefaultAsync(e => e.EmpId == empId, ct);
        if (emp is null || !emp.IsActive)
            throw new BusinessException($"デモ用社員 (ID: {empId}) が見つからないか無効です。");

        return await IssueAsync(emp, ct);
    }

    private async Task RevokeAllAsync(int empId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await db.RefreshTokens
            .Where(r => r.EmpId == empId && r.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.RevokedAt, now), ct);
    }

    private async Task<LoginResponse> IssueAsync(Employee emp, CancellationToken ct)
    {
        var user = ToAuthUser(emp);
        var (access, expiresIn) = tokens.CreateAccessToken(emp, user.Roles);
        var (raw, hash) = TokenService.CreateRefreshToken();
        var now = clock.GetUtcNow();

        db.RefreshTokens.Add(new RefreshToken
        {
            EmpId = emp.EmpId,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwt.Value.RefreshTokenDays),
        });
        await db.SaveChangesAsync(ct);

        return new LoginResponse(access, raw, expiresIn, user);
    }

    private static AuthUserDto ToAuthUser(Employee e) => new(
        e.EmpId, e.LoginId, e.EmpName, e.DeptCode,
        CodeCatalog.Name(CodeCatalog.Dept, e.DeptCode),
        e.WorkflowRoles.Select(r => r.Role).OrderBy(r => r).ToList());
}
