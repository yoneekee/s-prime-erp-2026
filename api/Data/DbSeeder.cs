using ErpApi.Common;
using ErpApi.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Data;

/// <summary>開発環境用の初期データ (Development 環境でのみ実行)</summary>
public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();

        await db.Database.MigrateAsync();

        if (!await db.Users.AnyAsync())
        {
            db.Users.AddRange(
                CreateUser(hasher, "admin", "Admin123!", "管理者", "情報システム部", Roles.Admin),
                CreateUser(hasher, "manager1", "Manager123!", "承認 次郎", "製造部", Roles.Manager),
                CreateUser(hasher, "user1", "User123!", "申請 花子", "製造部", Roles.User));
            await db.SaveChangesAsync();
        }

        if (!await db.Warehouses.AnyAsync())
        {
            var wh = new Warehouse
            {
                Code = "WH01", Name = "本社倉庫", Type = "自社", Address = "東京都千代田区",
                Capacity = 10000, Manager = "山田 太郎",
            };
            var item = new Item
            {
                Code = "ITM-0001", Name = "サンプル部品A", Spec = "10mm", Category = "部品",
                Unit = "個", Price = 120, SafetyStock = 50, DefaultWarehouseCode = "WH01",
            };
            item.Stocks.Add(new ItemStock { Warehouse = wh, Quantity = 500 });

            var partner = new Partner
            {
                Code = "PT001", Name = "株式会社サンプル商事", Type = PartnerType.BOTH,
                Representative = "佐藤 一郎", Contact = "鈴木 花子", Email = "info@example.com",
                Phone = "03-0000-0000", Address = "大阪府大阪市",
            };

            db.AddRange(wh, item, partner);
            await db.SaveChangesAsync();
        }
    }

    private static User CreateUser(IPasswordHasher<User> hasher, string username, string password,
        string name, string dept, string role)
    {
        var user = new User
        {
            Username = username, Name = name, Department = dept, Role = role,
            Email = $"{username}@example.com", IsActive = true,
        };
        user.PasswordHash = hasher.HashPassword(user, password);
        return user;
    }
}
