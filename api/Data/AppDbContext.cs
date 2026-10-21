using ErpApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, TimeProvider clock) : DbContext(options)
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<ItemStock> ItemStocks => Set<ItemStock>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Slip> Slips => Set<Slip>();
    public DbSet<SlipLine> SlipLines => Set<SlipLine>();
    public DbSet<SlipHistory> SlipHistories => Set<SlipHistory>();
    public DbSet<SlipSequence> SlipSequences => Set<SlipSequence>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<decimal>().HavePrecision(18, 4);

        // 列挙型は DB にも文字列で保存 (SQL で見たときに意味が分かるように)
        b.Properties<PartnerType>().HaveConversion<string>().HaveMaxLength(16);
        b.Properties<SlipType>().HaveConversion<string>().HaveMaxLength(8);
        b.Properties<SlipStatusCode>().HaveConversion<string>().HaveMaxLength(8);
    }

    protected override void OnModelCreating(ModelBuilder m)
    {
        ConfigureMaster<Employee>(m);
        ConfigureMaster<Item>(m);
        ConfigureMaster<Warehouse>(m);
        ConfigureMaster<Partner>(m);

        m.Entity<Item>().Property(x => x.DefaultWarehouseCode).HasMaxLength(50);

        m.Entity<ItemStock>(e =>
        {
            e.HasIndex(x => new { x.ItemId, x.WarehouseId }).IsUnique();
            e.HasOne(x => x.Item).WithMany(x => x.Stocks).HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Warehouse).WithMany(x => x.Stocks).HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<User>(e =>
        {
            e.Property(x => x.Username).HasMaxLength(100);
            e.HasIndex(x => x.Username).IsUnique();
        });

        m.Entity<RefreshToken>(e =>
        {
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<Slip>(e =>
        {
            e.Property(x => x.SlipNo).HasMaxLength(30);
            e.HasIndex(x => x.SlipNo).IsUnique();
            e.HasIndex(x => new { x.Status, x.Date });
            e.Property(x => x.Partner).HasMaxLength(50);
            e.Property(x => x.RowVersion).IsRowVersion();
            e.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.SlipId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Histories).WithOne().HasForeignKey(x => x.SlipId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<SlipLine>().Property(x => x.ItemCode).HasMaxLength(50);

        m.Entity<SlipSequence>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(30);
            e.Property(x => x.LastValue).IsConcurrencyToken();
        });
    }

    private static void ConfigureMaster<T>(ModelBuilder m) where T : MasterEntity
    {
        m.Entity<T>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(50);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasIndex(x => x.Code).IsUnique();
        });
    }

    /// <summary>マスタの作成日時・更新日時を自動設定</summary>
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow();
        foreach (var entry in ChangeTracker.Entries<MasterEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
