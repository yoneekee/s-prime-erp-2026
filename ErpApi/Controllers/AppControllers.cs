using ErpApi.Common;
using ErpApi.Dtos;
using ErpApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace ErpApi.Controllers;

// =====================================================================
// 認証  /api/auth
// =====================================================================

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ApiResponse<LoginResponse>> Login(LoginRequest req, CancellationToken ct)
        => ApiResponse.Ok(await auth.LoginAsync(req, ct));

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ApiResponse<LoginResponse>> Refresh(RefreshTokenRequest req, CancellationToken ct)
        => ApiResponse.Ok(await auth.RefreshAsync(req.RefreshToken, ct));

    [HttpPost("logout")]
    [Authorize]
    public async Task<ApiResponse<object?>> Logout(CancellationToken ct)
    {
        await auth.LogoutAsync(User.ToCurrentUser().EmpId, ct);
        return ApiResponse.Empty("ログアウトしました");
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ApiResponse<AuthUserDto>> Me(CancellationToken ct)
        => ApiResponse.Ok(await auth.GetMeAsync(User.ToCurrentUser().EmpId, ct));

    /// <summary>デモ用ロール切替 (Demo:Enabled=true の環境のみ)</summary>
    [HttpPost("demo/switch-role")]
    [Authorize]
    public async Task<ApiResponse<LoginResponse>> SwitchRole(SwitchRoleRequest req, CancellationToken ct)
        => ApiResponse.Ok(await auth.SwitchDemoRoleAsync(req.Role, ct));
}

// =====================================================================
// 伝票  /api/slips
// =====================================================================

[ApiController]
[Route("api/slips")]
[Authorize]
public sealed class SlipsController(SlipService slips) : ControllerBase
{
    /// <summary>伝票一覧 (ページング・検索)</summary>
    [HttpGet]
    public async Task<ApiResponse<PaginatedResponse<SlipSummaryDto>>> GetSlips([FromQuery] SlipSearchFilter filter, CancellationToken ct)
        => ApiResponse.Ok(await slips.SearchAsync(filter, ct));

    /// <summary>伝票詳細 (明細・ワークフロー履歴・実行可能アクション)</summary>
    [HttpGet("{slipNo}")]
    public async Task<ApiResponse<SlipDto>> GetSlip(string slipNo, CancellationToken ct)
        => ApiResponse.Ok(await slips.GetAsync(slipNo, User.ToCurrentUser(), ct));

    /// <summary>起票 (submit=true で申請まで)</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<SlipDto>>> CreateSlip(CreateSlipRequest req, CancellationToken ct)
    {
        var slip = await slips.CreateAsync(req, User.ToCurrentUser(), ct);
        return CreatedAtAction(nameof(GetSlip), new { slipNo = slip.SlipNo }, ApiResponse.Ok(slip));
    }

    /// <summary>修正 (S00 かつ起票者本人のみ)</summary>
    [HttpPut("{slipNo}")]
    public async Task<ApiResponse<SlipDto>> UpdateSlip(string slipNo, UpdateSlipRequest req, CancellationToken ct)
        => ApiResponse.Ok(await slips.UpdateAsync(slipNo, req, User.ToCurrentUser(), ct));

    /// <summary>ワークフローアクション実行 (申請・承認・否認・差戻・見積開始・分納入庫・配送開始など)</summary>
    [HttpPost("{slipNo}/actions")]
    public async Task<ApiResponse<SlipDto>> ExecuteAction(string slipNo, SlipActionRequest req, CancellationToken ct)
        => ApiResponse.Ok(await slips.ExecuteActionAsync(slipNo, req, User.ToCurrentUser(), ct));
}

// =====================================================================
// ダッシュボード  /api/dashboard
// =====================================================================

[ApiController]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController(DashboardService dashboard) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ApiResponse<DashboardSummaryDto>> Summary(CancellationToken ct)
        => ApiResponse.Ok(await dashboard.GetSummaryAsync(ct));

    [HttpGet("tasks")]
    public async Task<ApiResponse<List<PendingTaskDto>>> Tasks(CancellationToken ct)
        => ApiResponse.Ok(await dashboard.GetTasksAsync(User.ToCurrentUser(), ct));

    [HttpGet("low-stock")]
    public async Task<ApiResponse<List<ItemDto>>> LowStock(CancellationToken ct)
        => ApiResponse.Ok(await dashboard.GetLowStockAsync(ct));
}

// =====================================================================
// 通知  /api/notifications
// =====================================================================

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(DashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<NotificationListDto>> Get([FromQuery] int? limit, CancellationToken ct)
        => ApiResponse.Ok(await dashboard.GetNotificationsAsync(User.ToCurrentUser(), limit, ct));

    /// <summary>既読登録 (keys 省略時は全件既読)</summary>
    [HttpPost("read")]
    public async Task<ApiResponse<object?>> MarkRead(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] MarkNotificationsReadRequest? req,
        CancellationToken ct)
    {
        await dashboard.MarkReadAsync(User.ToCurrentUser(), req?.Keys, ct);
        return ApiResponse.Empty();
    }
}

// =====================================================================
// 共通コード  /api/codes/{group}
// =====================================================================

[ApiController]
[Route("api/codes")]
[Authorize]
public sealed class CodesController : ControllerBase
{
    /// <summary>group: dept / role-type / item-type / unit / account / location-type / partner-type / slip-type / slip-status / workflow-role</summary>
    [HttpGet("{group}")]
    public ApiResponse<IReadOnlyList<CodeItem>> Get(string group)
        => ApiResponse.Ok(CodeCatalog.Get(group) ?? throw new NotFoundException($"コードグループ {group} は存在しません"));
}
