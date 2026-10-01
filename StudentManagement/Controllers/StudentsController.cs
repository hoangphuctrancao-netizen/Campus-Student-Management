using System.Globalization;
using System.Text;
using Campus.StudentManagement.Data;
using Campus.StudentManagement.Models;
using Campus.StudentManagement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Controllers;

[ApiController]
[Route("api/students")]
[Authorize]
public class StudentsController(CampusDbContext db, AuditService audit) : ControllerBase
{
    public record StudentRequest(
        string StudentCode,
        string FullName,
        string Email,
        string? Phone,
        string Major,
        string Cohort,
        StudentStatus Status,
        StudentGender Gender,
        DateTime? DateOfBirth,
        string? Address,
        decimal GPA);

    [HttpGet]
    public async Task<IActionResult> GetAll(
        string? search = null,
        StudentStatus? status = null,
        string? major = null,
        string? cohort = null,
        string sortBy = "createdAt",
        string sortDir = "desc",
        int page = 1,
        int pageSize = 10)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 5, 100);
        var query = db.Students.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s =>
                s.FullName.ToLower().Contains(term) ||
                s.StudentCode.ToLower().Contains(term) ||
                s.Email.ToLower().Contains(term) ||
                s.Major.ToLower().Contains(term));
        }

        if (status.HasValue) query = query.Where(s => s.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(major)) query = query.Where(s => s.Major == major);
        if (!string.IsNullOrWhiteSpace(cohort)) query = query.Where(s => s.Cohort == cohort);

        var ascending = sortDir.Equals("asc", StringComparison.OrdinalIgnoreCase);
        query = sortBy.ToLowerInvariant() switch
        {
            "name" or "fullname" => ascending ? query.OrderBy(s => s.FullName) : query.OrderByDescending(s => s.FullName),
            "code" or "studentcode" => ascending ? query.OrderBy(s => s.StudentCode) : query.OrderByDescending(s => s.StudentCode),
            "gpa" => ascending ? query.OrderBy(s => s.GPA) : query.OrderByDescending(s => s.GPA),
            "major" => ascending ? query.OrderBy(s => s.Major) : query.OrderByDescending(s => s.Major),
            _ => ascending ? query.OrderBy(s => s.CreatedAt) : query.OrderByDescending(s => s.CreatedAt)
        };

        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new
        {
            items,
            pagination = new
            {
                page,
                pageSize,
                total,
                totalPages = (int)Math.Ceiling(total / (double)pageSize)
            }
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var student = await db.Students.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return student is null ? NotFound(new { message = "Không tìm thấy sinh viên." }) : Ok(student);
    }

    [HttpPost]
    public async Task<IActionResult> Create(StudentRequest request)
    {
        var validation = Validate(request);
        if (validation is not null) return BadRequest(new { message = validation });

        var normalizedCode = request.StudentCode.Trim();
        if (await db.Students.AnyAsync(x => x.StudentCode.ToLower() == normalizedCode.ToLower()))
            return Conflict(new { message = "Mã sinh viên đã tồn tại." });

        var student = Map(request);
        db.Students.Add(student);
        await db.SaveChangesAsync();
        await audit.WriteAsync("CREATE", "Student", student.Id.ToString(), $"Thêm {student.StudentCode} - {student.FullName}");

        return CreatedAtAction(nameof(GetById), new { id = student.Id }, student);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, StudentRequest request)
    {
        var validation = Validate(request);
        if (validation is not null) return BadRequest(new { message = validation });

        var student = await db.Students.FirstOrDefaultAsync(x => x.Id == id);
        if (student is null) return NotFound(new { message = "Không tìm thấy sinh viên." });

        if (await db.Students.AnyAsync(x => x.Id != id && x.StudentCode.ToLower() == request.StudentCode.Trim().ToLower()))
            return Conflict(new { message = "Mã sinh viên đã tồn tại." });

        Map(request, student);
        student.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.WriteAsync("UPDATE", "Student", student.Id.ToString(), $"Cập nhật {student.StudentCode} - {student.FullName}");

        return Ok(student);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var student = await db.Students.FirstOrDefaultAsync(x => x.Id == id);
        if (student is null) return NotFound(new { message = "Không tìm thấy sinh viên." });

        db.Students.Remove(student);
        await db.SaveChangesAsync();
        await audit.WriteAsync("DELETE", "Student", id.ToString(), $"Xóa {student.StudentCode} - {student.FullName}");
        return NoContent();
    }

    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete([FromBody] List<int> ids)
    {
        if (ids.Count == 0) return BadRequest(new { message = "Chưa chọn sinh viên." });
        var students = await db.Students.Where(x => ids.Contains(x.Id)).ToListAsync();
        db.Students.RemoveRange(students);
        await db.SaveChangesAsync();
        await audit.WriteAsync("BULK_DELETE", "Student", string.Join(',', ids), $"Xóa hàng loạt {students.Count} hồ sơ");
        return Ok(new { deleted = students.Count });
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportCsv()
    {
        var students = await db.Students.AsNoTracking().OrderBy(x => x.StudentCode).ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("Mã sinh viên,Họ và tên,Email,Số điện thoại,Ngành học,Khóa,Trạng thái,Giới tính,Ngày sinh,Địa chỉ,GPA");
        foreach (var s in students)
        {
            sb.AppendLine(string.Join(',',
                Csv(s.StudentCode), Csv(s.FullName), Csv(s.Email), Csv(s.Phone), Csv(s.Major), Csv(s.Cohort),
                Csv(StatusText(s.Status)), Csv(GenderText(s.Gender)), Csv(s.DateOfBirth?.ToString("dd/MM/yyyy")), Csv(s.Address), s.GPA.ToString("0.00", CultureInfo.InvariantCulture)));
        }

        await audit.WriteAsync("EXPORT", "Student", "*", $"Xuất CSV {students.Count} hồ sơ");
        return File(Encoding.UTF8.GetBytes("\uFEFF" + sb), "text/csv; charset=utf-8", "campus-students.csv");
    }

    [HttpPost("import")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> Import(IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "Vui lòng chọn file CSV." });
        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)) return BadRequest(new { message = "Chỉ hỗ trợ file .csv." });

        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var all = await reader.ReadToEndAsync();
        var lines = all.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return BadRequest(new { message = "File CSV chưa có dữ liệu." });

        var created = 0;
        var skipped = 0;
        for (var i = 1; i < lines.Length; i++)
        {
            var c = ParseCsvLine(lines[i]);
            if (c.Count < 11) { skipped++; continue; }
            var code = c[0].Trim();
            if (string.IsNullOrWhiteSpace(code) || await db.Students.AnyAsync(x => x.StudentCode.ToLower() == code.ToLower())) { skipped++; continue; }

            DateTime? dob = null;
            if (DateTime.TryParse(c[8], new CultureInfo("vi-VN"), DateTimeStyles.None, out var parsedDob)) dob = parsedDob;
            _ = decimal.TryParse(c[10], NumberStyles.Number, CultureInfo.InvariantCulture, out var gpa);

            var student = new Student
            {
                StudentCode = code, FullName = c[1].Trim(), Email = c[2].Trim(), Phone = c[3].Trim(), Major = c[4].Trim(), Cohort = c[5].Trim(),
                Status = ParseStatus(c[6]), Gender = ParseGender(c[7]), DateOfBirth = dob, Address = c[9].Trim(), GPA = Math.Clamp(gpa, 0, 4), CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            if (string.IsNullOrWhiteSpace(student.FullName) || string.IsNullOrWhiteSpace(student.Email) || !student.Email.Contains('@') || string.IsNullOrWhiteSpace(student.Major) || string.IsNullOrWhiteSpace(student.Cohort))
            { skipped++; continue; }
            db.Students.Add(student);
            created++;
        }

        await db.SaveChangesAsync();
        await audit.WriteAsync("IMPORT", "Student", "*", $"Nhập CSV: thêm {created}, bỏ qua {skipped}");
        return Ok(new { created, skipped });
    }

    [HttpGet("options")]
    public IActionResult Options()
    {
        var majors = new[] { "Công nghệ thông tin", "Quản trị kinh doanh", "Marketing", "Thiết kế đồ họa", "Ngôn ngữ Anh", "Tài chính - Ngân hàng", "Kỹ thuật phần mềm", "Truyền thông đa phương tiện" };
        var cohorts = new[] { "K22", "K23", "K24", "K25", "K26" };
        return Ok(new { majors, cohorts });
    }

    private static string? Validate(StudentRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.StudentCode)) return "Mã sinh viên không được để trống.";
        if (r.StudentCode.Trim().Length > 20) return "Mã sinh viên tối đa 20 ký tự.";
        if (string.IsNullOrWhiteSpace(r.FullName)) return "Họ và tên không được để trống.";
        if (string.IsNullOrWhiteSpace(r.Email) || !r.Email.Contains('@')) return "Email không hợp lệ.";
        if (string.IsNullOrWhiteSpace(r.Major)) return "Vui lòng chọn ngành học.";
        if (string.IsNullOrWhiteSpace(r.Cohort)) return "Vui lòng chọn khóa.";
        if (r.GPA < 0 || r.GPA > 4) return "GPA phải nằm trong khoảng 0 đến 4.";
        return null;
    }

    private static StudentStatus ParseStatus(string value) => value.Trim() switch
    {
        "Đang học" => StudentStatus.Active, "Chờ xác nhận" => StudentStatus.Pending, "Bảo lưu" => StudentStatus.Leave, "Đã tốt nghiệp" => StudentStatus.Graduated, _ => StudentStatus.Active
    };

    private static StudentGender ParseGender(string value) => value.Trim() switch
    {
        "Nam" => StudentGender.Male, "Nữ" => StudentGender.Female, _ => StudentGender.Other
    };

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (quoted && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; }
                else quoted = !quoted;
            }
            else if (ch == ',' && !quoted) { result.Add(current.ToString()); current.Clear(); }
            else current.Append(ch);
        }
        result.Add(current.ToString());
        return result;
    }

    private static Student Map(StudentRequest r, Student? student = null)
    {
        student ??= new Student();
        student.StudentCode = r.StudentCode.Trim();
        student.FullName = r.FullName.Trim();
        student.Email = r.Email.Trim();
        student.Phone = r.Phone?.Trim() ?? string.Empty;
        student.Major = r.Major.Trim();
        student.Cohort = r.Cohort.Trim();
        student.Status = r.Status;
        student.Gender = r.Gender;
        student.DateOfBirth = r.DateOfBirth;
        student.Address = r.Address?.Trim() ?? string.Empty;
        student.GPA = decimal.Round(r.GPA, 2);
        student.CreatedAt = student.CreatedAt == default ? DateTime.UtcNow : student.CreatedAt;
        student.UpdatedAt = DateTime.UtcNow;
        return student;
    }

    private static string Csv(object? value) => $"\"{(value?.ToString() ?? string.Empty).Replace("\"", "\"\"")}\"";
    private static string StatusText(StudentStatus value) => value switch { StudentStatus.Active => "Đang học", StudentStatus.Pending => "Chờ xác nhận", StudentStatus.Leave => "Bảo lưu", StudentStatus.Graduated => "Đã tốt nghiệp", _ => value.ToString() };
    private static string GenderText(StudentGender value) => value switch { StudentGender.Male => "Nam", StudentGender.Female => "Nữ", _ => "Khác" };
}
