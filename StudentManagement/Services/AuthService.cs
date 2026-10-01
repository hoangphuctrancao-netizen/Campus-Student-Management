using System.Security.Claims;
using Campus.StudentManagement.Data;
using Campus.StudentManagement.Models;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Services;

public class AuthService(CampusDbContext db)
{
    public async Task<AdminUser?> ValidateAsync(string email, string password)
    {
        var user = await db.AdminUsers.FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower() && x.IsActive);
        if (user is null || !PasswordHasher.Verify(password, user.PasswordHash)) return null;
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return user;
    }

    public static ClaimsPrincipal Principal(AdminUser user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.DisplayName),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role)
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "CampusCookie"));
    }
}
