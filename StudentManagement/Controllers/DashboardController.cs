using Campus.StudentManagement.Data;
using Campus.StudentManagement.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(CampusDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var students = db.Students.AsNoTracking();
        var total = await students.CountAsync();
        var active = await students.CountAsync(x => x.Status == StudentStatus.Active);
        var pending = await students.CountAsync(x => x.Status == StudentStatus.Pending);
        var leave = await students.CountAsync(x => x.Status == StudentStatus.Leave);
        var graduated = await students.CountAsync(x => x.Status == StudentStatus.Graduated);
        var avgGpa = total == 0 ? 0 : await students.AverageAsync(x => (double)x.GPA);

        var majorData = await students
            .GroupBy(x => x.Major)
            .Select(g => new { name = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .Take(7)
            .ToListAsync();

        var cohortData = await students
            .GroupBy(x => x.Cohort)
            .Select(g => new { name = g.Key, count = g.Count() })
            .OrderBy(x => x.name)
            .ToListAsync();

        var recent = await students.OrderByDescending(x => x.CreatedAt).Take(5).ToListAsync();

        return Ok(new
        {
            cards = new { total, active, pending, leave, graduated, avgGpa = Math.Round(avgGpa, 2) },
            majors = majorData,
            cohorts = cohortData,
            recent
        });
    }
}
