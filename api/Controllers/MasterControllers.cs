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
/// マスタ共通 CRUD。
///   GET    /api/{resource}          一覧 (ページング・検索)
///   GET    /api/{resource}/{id}     詳細
///   POST   /api/{resource}          登録
///   PUT    /api/{resource}/{id}     修正
///   DELETE /api/{resource}/{id}     削除
/// 各マスタは射影・検索条件・項目の反映・削除前チェックだけを実装する。
/// </summary>
[ApiController]
[Authorize]
public abstract class MasterControllerBase<TEntity, TDto, TRequest, TFilter>(AppDbContext db) : ControllerBase
    where TEntity : MasterEntity, new()
    where TDto : class
    where TRequest : class, IMasterRequest
    where TFilter : MasterSearchFilter
{
    protected AppDbContext Db { get; } = db;
    protected DbSet<TEntity> Set => Db.Set<TEntity>();

    /// <summary>エラーメッセージ用の名称 (例: "品目")</summary>
    protected abstract string EntityLabel { get; }
    protected abstract Expression<Func<TEntity, TDto>> ToDto { get; }
    protected abstract Expression<Func<TEntity, bool>> SearchPredicate(string text);
    protected abstract void ApplyFields(TRequest req, TEntity entity, bool isNew);

    protected virtual IQueryable<TEntity> ApplyExtraFilter(IQueryable<TEntity> q, TFilter filter) => q;
    protected virtual Task ValidateAsync(TRequest req, bool isNew, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task BeforeDeleteAsync(TEntity entity, CancellationToken ct) => Task.CompletedTask;

    [HttpGet]
    public async Task<ApiResponse<PaginatedResponse<TDto>>> GetAll([FromQuery] TFilter filter, CancellationToken ct)
    {
        IQueryable<TEntity> q = Set.AsNoTracking();
        if (filter.IsActive is bool active) q = q.Where(x => x.IsActive == active);
        if (!string.IsNullOrWhiteSpace(filter.SearchText)) q = q.Where(SearchPredicate(filter.SearchText.Trim()));
        q = ApplyExtraFilter(q, filter);

        return ApiResponse.Ok(await q.OrderBy(x => x.Code).ToPagedAsync(filter.Page, filter.PageSize, ToDto, ct));
    }

    [HttpGet("{id:int}")]
    public async Task<ApiResponse<TDto>> GetById(int id, CancellationToken ct)
        => ApiResponse.Ok(await FindDtoAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TDto>>> Create([FromBody] TRequest req, CancellationToken ct)
    {
        await EnsureCodeUniqueAsync(req.Code, null, ct);
        await ValidateAsync(req, isNew: true, ct);

        var entity = new TEntity();
        ApplyCommon(req, entity, isNew: true);
        Set.Add(entity);
        await Db.SaveChangesAsync(ct);

        var dto = await FindDtoAsync(entity.Id, ct);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, ApiResponse.Ok(dto));
    }

    [HttpPut("{id:int}")]
    public async Task<ApiResponse<TDto>> Update(int id, [FromBody] TRequest req, CancellationToken ct)
    {
        var entity = await Set.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw NotFoundError(id);
        await EnsureCodeUniqueAsync(req.Code, id, ct);
        await ValidateAsync(req, isNew: false, ct);

        ApplyCommon(req, entity, isNew: false);
        await Db.SaveChangesAsync(ct);

        return ApiResponse.Ok(await FindDtoAsync(id, ct));
    }

    [HttpDelete("{id:int}")]
    public async Task<ApiResponse<object?>> Delete(int id, CancellationToken ct)
    {
        var entity = await Set.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw NotFoundError(id);
        await BeforeDeleteAsync(entity, ct);

        Set.Remove(entity);
        await Db.SaveChangesAsync(ct);
        return ApiResponse.Empty($"{EntityLabel}を削除しました。");
    }

    protected async Task<TDto> FindDtoAsync(int id, CancellationToken ct)
        => await Set.AsNoTracking().Where(x => x.Id == id).Select(ToDto).FirstOrDefaultAsync(ct)
           ?? throw NotFoundError(id);

    private void ApplyCommon(TRequest req, TEntity entity, bool isNew)
    {
        entity.Code = req.Code.Trim();
        entity.Name = req.Name.Trim();
        if (req.IsActive is bool active) entity.IsActive = active;
        else if (isNew) entity.IsActive = true;
        ApplyFields(req, entity, isNew);
    }

    private async Task EnsureCodeUniqueAsync(string code, int? excludeId, CancellationToken ct)
    {
        var c = code.Trim();
        if (await Set.AnyAsync(x => x.Code == c && (excludeId == null || x.Id != excludeId), ct))
            throw new ConflictException($"{EntityLabel}コード {c} は既に使用されています。");
    }

    private NotFoundException NotFoundError(int id) => new($"{EntityLabel} (ID: {id}) が見つかりません。");
}

// =====================================================================
// 社員
// =====================================================================

[Route("api/employees")]
public sealed class EmployeesController(AppDbContext db)
    : MasterControllerBase<Employee, EmployeeDto, EmployeeRequest, MasterSearchFilter>(db)
{
    private static readonly Expression<Func<Employee, EmployeeDto>> Projection = x => new EmployeeDto(
        x.Id, x.Code, x.Name, x.Kana, x.Dept, x.Position, x.JoinDate, x.Email, x.Phone, x.IsActive);

    protected override string EntityLabel => "社員";
    protected override Expression<Func<Employee, EmployeeDto>> ToDto => Projection;

    protected override Expression<Func<Employee, bool>> SearchPredicate(string s)
        => x => x.Code.Contains(s) || x.Name.Contains(s) || x.Kana.Contains(s) || x.Dept.Contains(s);

    protected override void ApplyFields(EmployeeRequest r, Employee e, bool isNew)
    {
        e.Kana = r.Kana;
        e.Dept = r.Dept;
        e.Position = r.Position;
        e.JoinDate = r.JoinDate!.Value;
        e.Email = r.Email;
        e.Phone = r.Phone;
    }
}

// =====================================================================
// 品目
// =====================================================================

[Route("api/items")]
public sealed class ItemsController(AppDbContext db)
    : MasterControllerBase<Item, ItemDto, ItemRequest, MasterSearchFilter>(db)
{
    private static readonly Expression<Func<Item, ItemDto>> Projection = x => new ItemDto(
        x.Id, x.Code, x.Name, x.Spec, x.Category, x.Unit, x.Price,
        x.Stocks.Sum(s => (decimal?)s.Quantity) ?? 0,
        x.SafetyStock, x.DefaultWarehouseCode, x.IsActive);

    private int? _defaultWarehouseId;

    protected override string EntityLabel => "品目";
    protected override Expression<Func<Item, ItemDto>> ToDto => Projection;

    protected override Expression<Func<Item, bool>> SearchPredicate(string s)
        => x => x.Code.Contains(s) || x.Name.Contains(s) || x.Spec.Contains(s) || x.Category.Contains(s);

    protected override async Task ValidateAsync(ItemRequest req, bool isNew, CancellationToken ct)
    {
        _defaultWarehouseId = null;
        if (string.IsNullOrWhiteSpace(req.Warehouse)) return;

        var code = req.Warehouse.Trim();
        _defaultWarehouseId = await Db.Warehouses
            .Where(w => w.Code == code && w.IsActive)
            .Select(w => (int?)w.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw new BusinessException($"倉庫 {code} が存在しないか無効です。");
    }

    protected override void ApplyFields(ItemRequest r, Item e, bool isNew)
    {
        e.Spec = r.Spec;
        e.Category = r.Category;
        e.Unit = r.Unit;
        e.Price = r.Price;
        e.SafetyStock = r.SafetyStock;
        e.DefaultWarehouseCode = r.Warehouse.Trim();

        // 在庫数は新規登録時のみ初期在庫として計上 (以降は伝票で変動させる)
        if (isNew && r.StockQty > 0)
        {
            if (_defaultWarehouseId is not int whId)
                throw new BusinessException("初期在庫を登録するには倉庫を指定してください。");
            e.Stocks.Add(new ItemStock { WarehouseId = whId, Quantity = r.StockQty });
        }
    }

    protected override async Task BeforeDeleteAsync(Item e, CancellationToken ct)
    {
        if (await Db.ItemStocks.AnyAsync(s => s.ItemId == e.Id && s.Quantity != 0, ct))
            throw new ConflictException("在庫が残っている品目は削除できません。無効化してください。");
        if (await Db.SlipLines.AnyAsync(l => l.ItemCode == e.Code, ct))
            throw new ConflictException("伝票で使用されている品目は削除できません。無効化してください。");
    }

    /// <summary>品目コードで取得</summary>
    [HttpGet("code/{code}")]
    public async Task<ApiResponse<ItemDto>> GetByCode(string code, CancellationToken ct)
        => ApiResponse.Ok(
            await Db.Items.AsNoTracking().Where(x => x.Code == code).Select(Projection).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException($"品目コード {code} が見つかりません。"));

    /// <summary>倉庫別在庫照会</summary>
    [HttpGet("{itemCode}/stock")]
    public async Task<ApiResponse<List<ItemStockDto>>> GetStock(string itemCode, CancellationToken ct)
    {
        if (!await Db.Items.AnyAsync(x => x.Code == itemCode, ct))
            throw new NotFoundException($"品目コード {itemCode} が見つかりません。");

        var list = await Db.ItemStocks.AsNoTracking()
            .Where(s => s.Item.Code == itemCode)
            .OrderBy(s => s.Warehouse.Code)
            .Select(s => new ItemStockDto(s.Item.Code, s.Quantity, s.Warehouse.Code))
            .ToListAsync(ct);

        return ApiResponse.Ok(list);
    }
}

// =====================================================================
// 倉庫
// =====================================================================

[Route("api/warehouses")]
public sealed class WarehousesController(AppDbContext db)
    : MasterControllerBase<Warehouse, WarehouseDto, WarehouseRequest, MasterSearchFilter>(db)
{
    private static readonly Expression<Func<Warehouse, WarehouseDto>> Projection = x => new WarehouseDto(
        x.Id, x.Code, x.Name, x.Type, x.Address, x.Capacity,
        x.Stocks.Sum(s => (decimal?)s.Quantity) ?? 0,
        x.Manager, x.IsActive);

    protected override string EntityLabel => "倉庫";
    protected override Expression<Func<Warehouse, WarehouseDto>> ToDto => Projection;

    protected override Expression<Func<Warehouse, bool>> SearchPredicate(string s)
        => x => x.Code.Contains(s) || x.Name.Contains(s) || x.Address.Contains(s) || x.Manager.Contains(s);

    protected override void ApplyFields(WarehouseRequest r, Warehouse e, bool isNew)
    {
        e.Type = r.Type;
        e.Address = r.Address;
        e.Capacity = r.Capacity;
        e.Manager = r.Manager;
        // CurrentStock は在庫テーブルからの集計値のため反映しない
    }

    protected override async Task BeforeDeleteAsync(Warehouse e, CancellationToken ct)
    {
        if (await Db.ItemStocks.AnyAsync(s => s.WarehouseId == e.Id && s.Quantity != 0, ct))
            throw new ConflictException("在庫が残っている倉庫は削除できません。無効化してください。");
        if (await Db.Items.AnyAsync(i => i.DefaultWarehouseCode == e.Code, ct))
            throw new ConflictException("既定倉庫として設定している品目があるため削除できません。");
    }
}

// =====================================================================
// 取引先
// =====================================================================

[Route("api/partners")]
public sealed class PartnersController(AppDbContext db)
    : MasterControllerBase<Partner, PartnerDto, PartnerRequest, PartnerSearchFilter>(db)
{
    private static readonly Expression<Func<Partner, PartnerDto>> Projection = x => new PartnerDto(
        x.Id, x.Code, x.Name, x.Type, x.Representative, x.Contact, x.Email, x.Phone, x.Address, x.IsActive);

    protected override string EntityLabel => "取引先";
    protected override Expression<Func<Partner, PartnerDto>> ToDto => Projection;

    protected override Expression<Func<Partner, bool>> SearchPredicate(string s)
        => x => x.Code.Contains(s) || x.Name.Contains(s) || x.Representative.Contains(s) || x.Contact.Contains(s);

    protected override IQueryable<Partner> ApplyExtraFilter(IQueryable<Partner> q, PartnerSearchFilter f)
        => f.Type is { } t ? q.Where(TypeMatches(t)) : q;

    protected override void ApplyFields(PartnerRequest r, Partner e, bool isNew)
    {
        e.Type = r.Type!.Value;
        e.Representative = r.Representative;
        e.Contact = r.Contact;
        e.Email = r.Email;
        e.Phone = r.Phone;
        e.Address = r.Address;
    }

    protected override async Task BeforeDeleteAsync(Partner e, CancellationToken ct)
    {
        if (await Db.Slips.AnyAsync(s => s.Partner == e.Code, ct))
            throw new ConflictException("伝票で使用されている取引先は削除できません。無効化してください。");
    }

    /// <summary>
    /// プルダウン用: 有効な取引先をページングなしで返す。
    /// フロントの partnerService.getByType はこちらを呼ぶように変更する。
    /// </summary>
    [HttpGet("lookup")]
    public async Task<ApiResponse<List<PartnerDto>>> Lookup([FromQuery] PartnerType? type, CancellationToken ct)
    {
        var q = Db.Partners.AsNoTracking().Where(x => x.IsActive);
        if (type is { } t) q = q.Where(TypeMatches(t));
        return ApiResponse.Ok(await q.OrderBy(x => x.Code).Select(Projection).ToListAsync(ct));
    }

    /// <summary>CUSTOMER / SUPPLIER 指定時は BOTH も含める</summary>
    private static Expression<Func<Partner, bool>> TypeMatches(PartnerType t)
    {
        if (t == PartnerType.BOTH) return x => x.Type == PartnerType.BOTH;
        return x => x.Type == t || x.Type == PartnerType.BOTH;
    }
}
