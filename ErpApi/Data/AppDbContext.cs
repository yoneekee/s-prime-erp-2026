using ErpApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, TimeProvider clock) : DbContext(options)
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeRole> EmployeeRoles => Set<EmployeeRole>();
    public DbSet<UserCredential> UserCredentials => Set<UserCredential>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Slip> Slips => Set<Slip>();
    public DbSet<SlipDetail> SlipDetails => Set<SlipDetail>();
    public DbSet<SlipWorkflowEntry> SlipWorkflowEntries => Set<SlipWorkflowEntry>();
    public DbSet<SlipSequence> SlipSequences => Set<SlipSequence>();
    public DbSet<NotificationState> NotificationStates => Set<NotificationState>();
    public DbSet<NotificationReadKey> NotificationReadKeys => Set<NotificationReadKey>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<decimal>().HavePrecision(18, 2);
    }

    protected override void OnModelCreating(ModelBuilder m)
    {
        // ---------------------------------------------------------- マスタ
        m.Entity<Employee>(e =>
        {
            e.HasKey(x => x.EmpId);
            e.Property(x => x.LoginId).HasMaxLength(50);
            e.HasIndex(x => x.LoginId).IsUnique();
            e.Property(x => x.EmpName).HasMaxLength(100);
            e.Property(x => x.DeptCode).HasMaxLength(20);
            e.Property(x => x.RoleType).HasMaxLength(20);
            e.Property(x => x.Email).HasMaxLength(256);
            e.HasMany(x => x.WorkflowRoles).WithOne().HasForeignKey(x => x.EmpId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<EmployeeRole>(e =>
        {
            e.HasKey(x => new { x.EmpId, x.Role });
            e.Property(x => x.Role).HasMaxLength(20);
        });

        m.Entity<UserCredential>(e =>
        {
            e.HasKey(x => x.EmpId);
            e.Property(x => x.EmpId).ValueGeneratedNever();
            e.HasOne<Employee>().WithOne().HasForeignKey<UserCredential>(x => x.EmpId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<Item>(e =>
        {
            e.HasKey(x => x.ItemId);
            e.Property(x => x.ItemCode).HasMaxLength(50);
            e.HasIndex(x => x.ItemCode).IsUnique();
            e.Property(x => x.ItemName).HasMaxLength(200);
            e.Property(x => x.ItemType).HasMaxLength(10);
            e.Property(x => x.Unit).HasMaxLength(10);
            e.Property(x => x.AcctCode).HasMaxLength(10);
            e.Property(x => x.StockQty).IsConcurrencyToken();
        });

        m.Entity<Location>(e =>
        {
            e.HasKey(x => x.LocId);
            e.Property(x => x.LocName).HasMaxLength(100);
            e.Property(x => x.LocType).HasMaxLength(20);
        });

        m.Entity<Partner>(e =>
        {
            e.HasKey(x => x.PartnerId);
            e.Property(x => x.PartnerCode).HasMaxLength(50);
            e.HasIndex(x => x.PartnerCode).IsUnique();
            e.Property(x => x.PartnerName).HasMaxLength(200);
            e.Property(x => x.PartnerType).HasMaxLength(10);
        });

        // ---------------------------------------------------------- 認証
        m.Entity<RefreshToken>(e =>
        {
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmpId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------- 伝票
        m.Entity<Slip>(e =>
        {
            e.HasKey(x => x.SlipId);
            e.Property(x => x.SlipNo).HasMaxLength(30);
            e.HasIndex(x => x.SlipNo).IsUnique();
            e.Property(x => x.SlipType).HasMaxLength(8);
            e.Property(x => x.Status).HasMaxLength(8);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.Date);
            e.Property(x => x.RowVersion).IsRowVersion();
            e.HasMany(x => x.Details).WithOne().HasForeignKey(x => x.SlipId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Workflow).WithOne(x => x.Slip).HasForeignKey(x => x.SlipId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<SlipDetail>(e =>
        {
            e.HasIndex(x => x.SlipId);
            e.Property(x => x.ItemCode).HasMaxLength(50);
            e.Property(x => x.LotNo).HasMaxLength(50);
        });

        m.Entity<SlipWorkflowEntry>(e =>
        {
            e.HasIndex(x => x.ProcAt);
            e.Property(x => x.Action).HasMaxLength(30);
            e.Property(x => x.FromStatus).HasMaxLength(8);
            e.Property(x => x.ToStatus).HasMaxLength(8);
        });

        m.Entity<SlipSequence>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(20);
            e.Property(x => x.LastValue).IsConcurrencyToken();
        });

        // ---------------------------------------------------------- 通知
        m.Entity<NotificationState>(e =>
        {
            e.HasKey(x => x.EmpId);
            e.Property(x => x.EmpId).ValueGeneratedNever();
        });

        m.Entity<NotificationReadKey>(e =>
        {
            e.HasKey(x => new { x.EmpId, x.Key });
            e.Property(x => x.Key).HasMaxLength(50);
        });

        // ---------------------------------------------------------- 初期データ (mock-data.ts と同じ)
        SeedData.Apply(m);
    }

    /// <summary>マスタの作成日時・更新日時を自動設定</summary>
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow();
        foreach (var entry in ChangeTracker.Entries<IAuditable>())
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
