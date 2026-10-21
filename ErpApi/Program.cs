using System.Text;
using ErpApi.Common;
using ErpApi.Data;
using ErpApi.Domain;
using ErpApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ------------------------------------------------------------------ 設定
builder.Services.Configure<JwtOptions>(config.GetSection("Jwt"));
builder.Services.Configure<DemoOptions>(config.GetSection("Demo"));
builder.Services.Configure<InventoryOptions>(config.GetSection("Inventory"));

var jwt = config.GetSection("Jwt").Get<JwtOptions>()
          ?? throw new InvalidOperationException("appsettings に Jwt セクションがありません。");
if (Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32)
    throw new InvalidOperationException("Jwt:SigningKey は 32 バイト以上にしてください。");

builder.Services.AddSingleton(TimeProvider.System);

// ------------------------------------------------------------------ DB
// PostgreSQL の場合: Npgsql.EntityFrameworkCore.PostgreSQL を追加して UseNpgsql に変更
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(config.GetConnectionString("Default")));

// ------------------------------------------------------------------ MVC / バリデーションエラーの形式
builder.Services
    .AddControllers(o =>
    {
        // string 型プロパティが暗黙で必須扱いになるのを防ぐ (必須は [Required] で明示)
        o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .ConfigureApiBehaviorOptions(o =>
    {
        // 入力チェックエラーも ApiResponse 形式で返す
        o.InvalidModelStateResponseFactory = ctx =>
        {
            var errors = ctx.ModelState
                .Where(kv => kv.Value is { Errors.Count: > 0 })
                .SelectMany(kv => kv.Value!.Errors.Select(e =>
                {
                    var msg = string.IsNullOrEmpty(e.ErrorMessage) ? e.Exception?.Message ?? "不正な値です" : e.ErrorMessage;
                    return string.IsNullOrEmpty(kv.Key) ? msg : $"{kv.Key}: {msg}";
                }))
                .ToList();
            return new BadRequestObjectResult(ApiResponse.Fail("入力内容に誤りがあります", errors));
        };
    });

// ------------------------------------------------------------------ 認証 (JWT)
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // "sub" "role" などのクレーム名をそのまま使う
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = AppClaims.Name,
            RoleClaimType = AppClaims.Role,
        };
        // 401 / 403 も ApiResponse 形式で返す
        o.Events = new JwtBearerEvents
        {
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsJsonAsync(ApiResponse.Fail("認証が必要です。再度ログインしてください"));
            },
            OnForbidden = async ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(ApiResponse.Fail("この操作を行う権限がありません"));
            },
        };
    });
builder.Services.AddAuthorization();

// ------------------------------------------------------------------ CORS (Vite 開発サーバー)
var origins = config.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

// ------------------------------------------------------------------ アプリケーションサービス
builder.Services.AddScoped<IPasswordHasher<Employee>, PasswordHasher<Employee>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<SlipNumberGenerator>();
builder.Services.AddScoped<SlipService>();
builder.Services.AddScoped<DashboardService>();

builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();

// ------------------------------------------------------------------ パイプライン
var app = builder.Build();

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsDevelopment())
{
    await DbSeeder.SeedAsync(app.Services);
}

app.Run();
