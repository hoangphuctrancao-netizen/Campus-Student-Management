using Campus.StudentManagement.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Campus.StudentManagement.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    public record LoginRequest(string Email, string Password, bool Remember = false);

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Vui lòng nhập email và mật khẩu." });

        var user = await auth.ValidateAsync(request.Email.Trim(), request.Password);
        if (user is null) return Unauthorized(new { message = "Email hoặc mật khẩu không chính xác." });

        var properties = new AuthenticationProperties
        {
            IsPersistent = request.Remember,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(request.Remember ? 72 : 8)
        };

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, AuthService.Principal(user), properties);
        return Ok(new { user = new { id = user.Id, user.Email, user.DisplayName, user.Role } });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        if (!(User.Identity?.IsAuthenticated ?? false)) return Unauthorized();
        return Ok(new
        {
            user = new
            {
                id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
                email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value,
                displayName = User.Identity?.Name,
                role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
            }
        });
    }
}
