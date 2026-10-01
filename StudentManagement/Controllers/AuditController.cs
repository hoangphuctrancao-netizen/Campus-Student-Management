using Campus.StudentManagement.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Controllers;

[ApiController]
[Route("api/audit")]
[Authorize]
public class AuditController(CampusDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(int page = 1, int pageSize = 15)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 100);
        var query = db.AuditLogs.AsNoTracking().OrderByDescending(x => x.CreatedAt);
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, pagination = new { page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) } });
    }
}
