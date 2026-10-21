using System.Linq.Expressions;
using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using ErpApi.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Controllers;

/// <summary>
/// マスタ共通 CRUD
///   GET    /api/{resource}           一覧 (ページング・検索)
///   GET    /api/{resource}/options   プルダウン用 (有効データのみ・ページングなし)
///   GET    /api/{resource}/{id}      詳細
///   POST   /api/{resource}           登録
///   PUT    /api/{resource}/{id}      修正
///   DELETE /api/{resource}/{id}      削除 (使用中は 409)
/// </summary>
[ApiController]
[Authorize]
public abstract class MasterControllerBase<TEntity, TDto, TRequest, TFilter>(AppDbContext db) : ControllerBase
    where TEntity : class, IMasterEntity, new()
    where TDto : class
    where TRequest : class, IMasterRequest
    where TFilter : MasterSearchFilter
{
    protected AppDbContext Db { get; } = db;
    protected DbSet<TEntity> Set => Db.Set<TEntity>();

    /// <summary>エラーメッセージ用の名称 (例: "品目")</summary>
    protected abstract string EntityLabel { get; }
    /// <summary>主キーのプロパティ名 (例: "ItemId")</summary>
    protected abstract string KeyName { get; }
    protected abstract Expression<Func<TEntity, TDto>> ToDto { get; }
    protected abstract Expression<Func<TEntity, bool>> SearchPredicate(string text);
    protected abstract void ApplyFields(TRequest req, TEntity entity, bool isNew);

    protected virtual IQueryable<TEntity> ApplyExtraFilter(IQueryable<TEntity> q, TFilter filter) => q;
    protected virtual IQueryable<TEntity> QueryForUpdate() => Set;
    protected virtual Task ValidateAsync(TRequest req, int? id, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task BeforeDeleteAsync(int id, CancellationToken ct) => Task.CompletedTask;

    [HttpGet]
    public async Task<ApiResponse<PaginatedResponse<TDto>>> GetAll([FromQuery] TFilter filter, CancellationToken ct)
        => ApiResponse.Ok(await Filter(filter, activeOnly: false).ToPagedAsync(filter.Page, filter.PageSize, ToDto, ct));

    [HttpGet("options")]
    public async Task<ApiResponse<List<TDto>>> GetOptions([FromQuery] TFilter filter, CancellationToken ct)
        => ApiResponse.Ok(await Filter(filter, activeOnly: true).Select(ToDto).ToListAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ApiResponse<TDto>> GetById(int id, CancellationToken ct)
        => ApiResponse.Ok(await FindDtoAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TDto>>> Create([FromBody] TRequest req, CancellationToken ct)
    {
        await ValidateAsync(req, null, ct);

        var entity = new TEntity { IsActive = req.IsActive ?? true };
        ApplyFields(req, entity, isNew: true);
        Set.Add(entity);
        await Db.SaveChangesAsync(ct);

        var id = Db.Entry(entity).Property<int>(KeyName).CurrentValue;
        return CreatedAtAction(nameof(GetById), new { id }, ApiResponse.Ok(await FindDtoAsync(id, ct)));
    }

    [HttpPut("{id:int}")]
    public async Task<ApiResponse<TDto>> Update(int id, [FromBody] TRequest req, CancellationToken ct)
    {
        var key = KeyName;
        var entity = await QueryForUpdate().FirstOrDefaultAsync(x => EF.Property<int>(x, key) == id, ct)
            ?? throw NotFoundError(id);

        await ValidateAsync(req, id, ct);
        if (req.IsActive is bool active) entity.IsActive = active;
        ApplyFields(req, entity, isNew: false);
        await Db.SaveChangesAsync(ct);

        return ApiResponse.Ok(await FindDtoAsync(id, ct));
    }

    [HttpDelete("{id:int}")]
    public async Task<ApiResponse<object?>> Delete(int id, CancellationToken ct)
    {
        var key = KeyName;
        var entity = await Set.FirstOrDefaultAsync(x => EF.Property<int>(x, key) == id, ct)
            ?? throw NotFoundError(id);

        await BeforeDeleteAsync(id, ct);
        Set.Remove(entity);
        await Db.SaveChangesAsync(ct);
        return ApiResponse.Empty($"{EntityLabel}を削除しました");
    }

    protected static void RequireCode(string group, string? code, string label)
    {
        if (!CodeCatalog.Exists(group, code))
            throw new BusinessException($"{label}のコードが不正です: {code}");
    }

    private IQueryable<TEntity> Filter(TFilter filter, bool activeOnly)
    {
        IQueryable<TEntity> q = Set.AsNoTracking();

        if (activeOnly)
            q = q.Where(x => EF.Property<bool>(x, nameof(IMasterEntity.IsActive)));
        else if (filter.IsActive is bool active)
            q = q.Where(x => EF.Property<bool>(x, nameof(IMasterEntity.IsActive)) == active);

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
            q = q.Where(SearchPredicate(filter.SearchText.Trim()));

        q = ApplyExtraFilter(q, filter);

        var key = KeyName;
        return q.OrderBy(x => EF.Property<int>(x, key));
    }

    private async Task<TDto> FindDtoAsync(int id, CancellationToken ct)
    {
        var key = KeyName;
        return await Set.AsNoTracking()
            .Where(x => EF.Property<int>(x, key) == id)
            .Select(ToDto)
            .FirstOrDefaultAsync(ct)
            ?? throw NotFoundError(id);
    }

    private NotFoundException NotFoundError(int id) => new($"{EntityLabel} (ID: {id}) が見つかりません");
}

// =====================================================================
// 社員 /api/employees
// =====================================================================

[Route("api/employees")]
public sealed class EmployeesController(AppDbContext db)
    : MasterControllerBase<Employee, EmployeeDto, EmployeeRequest, EmployeeSearchFilter>(db)
{
    protected override string EntityLabel => "社員";
    protected override string KeyName => nameof(Employee.EmpId);
    protected override Expression<Func<Employee, EmployeeDto>> ToDto => MasterMappings.ToEmployeeDto;

    protected override Expression<Func<Employee, bool>> SearchPredicate(string s)
        => x => x.LoginId.Contains(s) || x.EmpName.Contains(s) || x.Email.Contains(s) || x.Remarks.Contains(s);

    protected override IQueryable<Employee> ApplyExtraFilter(IQueryable<Employee> q, EmployeeSearchFilter f)
    {
        if (!string.IsNullOrWhiteSpace(f.DeptCode))
        {
            var v = f.DeptCode;
            q = q.Where(x => x.DeptCode == v);
        }
        if (!string.IsNullOrWhiteSpace(f.RoleType))
        {
            var v = f.RoleType;
            q = q.Where(x => x.RoleType == v);
        }
        if (!string.IsNullOrWhiteSpace(f.WorkflowRole))
        {
            var v = f.WorkflowRole;
            q = q.Where(x => x.WorkflowRoles.Any(r => r.Role == v));
        }
        return q;
    }

    protected override IQueryable<Employee> QueryForUpdate() => Set.Include(x => x.WorkflowRoles);

    protected override async Task ValidateAsync(EmployeeRequest r, int? id, CancellationToken ct)
    {
        RequireCode(CodeCatalog.Dept, r.DeptCode, "部署");
        RequireCode(CodeCatalog.RoleType, r.RoleType, "権限種別");

        var invalidRole = r.WorkflowRoles?.FirstOrDefault(role => !WorkflowRoles.All.Contains(role));
        if (invalidRole is not null)
            throw new BusinessException($"ワークフローロールが不正です: {invalidRole}");

        var loginId = r.LoginId.Trim();
        if (await Db.Employees.AnyAsync(x => x.LoginId == loginId && (id == null || x.EmpId != id), ct))
            throw new ConflictException($"ログインID {loginId} は既に使用されています");
    }

    protected override void ApplyFields(EmployeeRequest r, Employee e, bool isNew)
    {
        e.LoginId = r.LoginId.Trim();
        e.EmpName = r.EmpName.Trim();
        e.DeptCode = r.DeptCode;
        e.RoleType = r.RoleType;
        e.Email = r.Email.Trim();
        e.Remarks = r.Remarks?.Trim() ?? "";

        if (r.WorkflowRoles is not null)
        {
            // 差分更新 (同じキーの削除→追加を避ける)
            var next = r.WorkflowRoles.ToHashSet();
            e.WorkflowRoles.RemoveAll(x => !next.Contains(x.Role));
            foreach (var role in next.Where(role => e.WorkflowRoles.TrueForAll(x => x.Role != role)))
                e.WorkflowRoles.Add(new EmployeeRole { Role = role });
        }
    }

    protected override async Task BeforeDeleteAsync(int id, CancellationToken ct)
    {
        if (await Db.Slips.AnyAsync(s => s.RequestEmpId == id, ct) ||
            await Db.SlipWorkflowEntries.AnyAsync(w => w.EmpId == id, ct))
            throw new ConflictException("伝票で使用されている社員は削除できません。無効化してください");
    }
}

// =====================================================================
// 品目 /api/items
// =====================================================================

[Route("api/items")]
public sealed class ItemsController(AppDbContext db)
    : MasterControllerBase<Item, ItemDto, ItemRequest, ItemSearchFilter>(db)
{
    protected override string EntityLabel => "品目";
    protected override string KeyName => nameof(Item.ItemId);
    protected override Expression<Func<Item, ItemDto>> ToDto => MasterMappings.ToItemDto;

    protected override Expression<Func<Item, bool>> SearchPredicate(string s)
        => x => x.ItemCode.Contains(s) || x.ItemName.Contains(s) || x.Spec.Contains(s);

    protected override IQueryable<Item> ApplyExtraFilter(IQueryable<Item> q, ItemSearchFilter f)
    {
        if (string.IsNullOrWhiteSpace(f.ItemType)) return q;
        var v = f.ItemType;
        return q.Where(x => x.ItemType == v);
    }

    protected override async Task ValidateAsync(ItemRequest r, int? id, CancellationToken ct)
    {
        RequireCode(CodeCatalog.ItemType, r.ItemType, "品目分類");
        RequireCode(CodeCatalog.Unit, r.Unit, "管理単位");
        RequireCode(CodeCatalog.Account, r.AcctCode, "勘定科目");

        var code = r.ItemCode.Trim();
        if (await Db.Items.AnyAsync(x => x.ItemCode == code && (id == null || x.ItemId != id), ct))
            throw new ConflictException($"品目コード {code} は既に使用されています");
    }

    protected override void ApplyFields(ItemRequest r, Item e, bool isNew)
    {
        e.ItemCode = r.ItemCode.Trim();
        e.ItemName = r.ItemName.Trim();
        e.ItemType = r.ItemType;
        e.Spec = r.Spec?.Trim() ?? "";
        e.Unit = r.Unit;
        e.StdPrice = r.StdPrice;
        e.PlanQty = r.PlanQty;
        e.StockQty = r.StockQty; // 現行画面と同じくマスタ画面から編集可
        e.SafetyStock = r.SafetyStock;
        e.AcctCode = r.AcctCode;
    }

    protected override async Task BeforeDeleteAsync(int id, CancellationToken ct)
    {
        if (await Db.SlipDetails.AnyAsync(d => d.ItemId == id, ct))
            throw new ConflictException("伝票で使用されている品目は削除できません。無効化してください");
    }
}

// =====================================================================
// 倉庫拠点 /api/locations
// =====================================================================

[Route("api/locations")]
public sealed class LocationsController(AppDbContext db)
    : MasterControllerBase<Location, LocationDto, LocationRequest, LocationSearchFilter>(db)
{
    protected override string EntityLabel => "倉庫拠点";
    protected override string KeyName => nameof(Location.LocId);
    protected override Expression<Func<Location, LocationDto>> ToDto => MasterMappings.ToLocationDto;

    protected override Expression<Func<Location, bool>> SearchPredicate(string s)
        => x => x.LocName.Contains(s) || x.Address.Contains(s) || x.Remarks.Contains(s);

    protected override IQueryable<Location> ApplyExtraFilter(IQueryable<Location> q, LocationSearchFilter f)
    {
        if (string.IsNullOrWhiteSpace(f.LocType)) return q;
        var v = f.LocType;
        return q.Where(x => x.LocType == v);
    }

    protected override Task ValidateAsync(LocationRequest r, int? id, CancellationToken ct)
    {
        RequireCode(CodeCatalog.LocationType, r.LocType, "倉庫種別");
        return Task.CompletedTask;
    }

    protected override void ApplyFields(LocationRequest r, Location e, bool isNew)
    {
        e.LocName = r.LocName.Trim();
        e.LocType = r.LocType;
        e.PostalCode = r.PostalCode?.Trim() ?? "";
        e.Address = r.Address?.Trim() ?? "";
        e.ContactInfo = r.ContactInfo?.Trim() ?? "";
        e.Remarks = r.Remarks?.Trim() ?? "";
    }

    protected override async Task BeforeDeleteAsync(int id, CancellationToken ct)
    {
        if (await Db.Slips.AnyAsync(s => s.FromLocId == id, ct))
            throw new ConflictException("伝票で使用されている倉庫拠点は削除できません。無効化してください");
    }
}

// =====================================================================
// 取引先 /api/partners
// =====================================================================

[Route("api/partners")]
public sealed class PartnersController(AppDbContext db)
    : MasterControllerBase<Partner, PartnerDto, PartnerRequest, PartnerSearchFilter>(db)
{
    protected override string EntityLabel => "取引先";
    protected override string KeyName => nameof(Partner.PartnerId);
    protected override Expression<Func<Partner, PartnerDto>> ToDto => MasterMappings.ToPartnerDto;

    protected override Expression<Func<Partner, bool>> SearchPredicate(string s)
        => x => x.PartnerCode.Contains(s) || x.PartnerName.Contains(s) || x.Address.Contains(s);

    /// <summary>SUPPLIER / CUSTOMER 指定時は BOTH も含める</summary>
    protected override IQueryable<Partner> ApplyExtraFilter(IQueryable<Partner> q, PartnerSearchFilter f)
    {
        if (string.IsNullOrWhiteSpace(f.PartnerType)) return q;
        var v = f.PartnerType;
        return v == "BOTH"
            ? q.Where(x => x.PartnerType == "BOTH")
            : q.Where(x => x.PartnerType == v || x.PartnerType == "BOTH");
    }

    protected override async Task ValidateAsync(PartnerRequest r, int? id, CancellationToken ct)
    {
        RequireCode(CodeCatalog.PartnerType, r.PartnerType, "取引先種別");

        var code = r.PartnerCode.Trim();
        if (await Db.Partners.AnyAsync(x => x.PartnerCode == code && (id == null || x.PartnerId != id), ct))
            throw new ConflictException($"取引先コード {code} は既に使用されています");
    }

    protected override void ApplyFields(PartnerRequest r, Partner e, bool isNew)
    {
        e.PartnerCode = r.PartnerCode.Trim();
        e.PartnerName = r.PartnerName.Trim();
        e.PartnerType = r.PartnerType;
        e.PostalCode = r.PostalCode?.Trim() ?? "";
        e.Address = r.Address?.Trim() ?? "";
    }

    protected override async Task BeforeDeleteAsync(int id, CancellationToken ct)
    {
        if (await Db.Slips.AnyAsync(s => s.PartnerId == id, ct))
            throw new ConflictException("伝票で使用されている取引先は削除できません。無効化してください");
    }
}
