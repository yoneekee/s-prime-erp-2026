using ErpApi.Domain;
using ErpApi.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ErpApi.Data;

/// <summary>
/// 開発環境用 (Development でのみ実行)。
/// マイグレーション適用後、パスワード未設定の社員にデモ用パスワード (Demo:Password) を設定する。
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Employee>>();
        var demo = scope.ServiceProvider.GetRequiredService<IOptions<DemoOptions>>().Value;

        await db.Database.MigrateAsync();

        var hasCredential = await db.UserCredentials.Select(c => c.EmpId).ToListAsync();
        var targets = await db.Employees.Where(e => !hasCredential.Contains(e.EmpId)).ToListAsync();

        foreach (var emp in targets)
        {
            db.UserCredentials.Add(new UserCredential
            {
                EmpId = emp.EmpId,
                PasswordHash = hasher.HashPassword(emp, demo.Password),
            });
        }
        await db.SaveChangesAsync();
    }
}
