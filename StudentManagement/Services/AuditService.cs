using System.Security.Claims;
using Campus.StudentManagement.Data;
using Campus.StudentManagement.Models;

namespace Campus.StudentManagement.Services;

public class AuditService(CampusDbContext db, IHttpContextAccessor http)
{
    public async Task WriteAsync(string action, string entity, string entityId, string details)
    {
        var actor = http.HttpContext?.User?.FindFirstValue(ClaimTypes.Email) ?? "system";
        db.AuditLogs.Add(new AuditLog
        {
            Action = action,
            Entity = entity,
            EntityId = entityId,
            Details = details,
            PerformedBy = actor,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
}
