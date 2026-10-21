using ErpApi.Common;
using ErpApi.Dtos;
using ErpApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
        await auth.LogoutAsync(User.ToCurrentUser().Id, ct);
        return ApiResponse.Empty("ログアウトしました。");
    }
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
    public async Task<ApiResponse<PaginatedResponse<SlipRecordDto>>> GetSlips([FromQuery] SlipSearchFilter filter, CancellationToken ct)
        => ApiResponse.Ok(await slips.SearchAsync(filter, ct));

    /// <summary>伝票詳細</summary>
    [HttpGet("{slipNo}")]
    public async Task<ApiResponse<SlipDetailDto>> GetSlipDetail(string slipNo, CancellationToken ct)
        => ApiResponse.Ok(await slips.GetDetailAsync(slipNo, ct));

    /// <summary>伝票作成 (ステータス S00 で登録)</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<SlipDetailDto>>> CreateSlip(CreateSlipRequest req, CancellationToken ct)
    {
        var detail = await slips.CreateAsync(req, User.ToCurrentUser(), ct);
        return CreatedAtAction(nameof(GetSlipDetail), new { slipNo = detail.SlipNo }, ApiResponse.Ok(detail));
    }

    /// <summary>伝票修正 (S00 / A02 のみ)</summary>
    [HttpPut("{slipNo}")]
    public async Task<ApiResponse<SlipDetailDto>> UpdateSlip(string slipNo, UpdateSlipRequest req, CancellationToken ct)
        => ApiResponse.Ok(await slips.UpdateAsync(slipNo, req, User.ToCurrentUser(), ct));

    /// <summary>伝票削除 (S00 / A02 のみ)</summary>
    [HttpDelete("{slipNo}")]
    public async Task<ApiResponse<object?>> DeleteSlip(string slipNo, CancellationToken ct)
    {
        await slips.DeleteAsync(slipNo, User.ToCurrentUser(), ct);
        return ApiResponse.Empty($"伝票 {slipNo} を削除しました。");
    }

    /// <summary>ステータス変更 (申請・承認・差戻・購買/出庫処理)</summary>
    [HttpPatch("{slipNo}/status")]
    public async Task<ApiResponse<SlipDetailDto>> ChangeStatus(string slipNo, ChangeSlipStatusRequest req, CancellationToken ct)
        => ApiResponse.Ok(await slips.ChangeStatusAsync(slipNo, req, User.ToCurrentUser(), ct));
}
