using System.Security.Cryptography;
using Campus.StudentManagement.Models;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration config)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CampusDbContext>();
        await db.Database.EnsureCreatedAsync();

        if (!await db.AdminUsers.AnyAsync())
        {
            var email = config["Campus:AdminEmail"] ?? "admin@campus.edu.vn";
            var password = config["Campus:AdminPassword"] ?? "Admin@123";

            db.AdminUsers.Add(new AdminUser
            {
                Email = email,
                DisplayName = "Quản trị viên Campus",
                PasswordHash = PasswordHasher.Hash(password),
                Role = "Administrator"
            });
        }

        if (!await db.Students.AnyAsync())
        {
            var now = DateTime.UtcNow;
            db.Students.AddRange(
                new Student { StudentCode = "SV2023001", FullName = "Nguyễn Minh Anh", Email = "minhanh.nguyen@campus.edu.vn", Phone = "0901000001", Major = "Công nghệ thông tin", Cohort = "K23", Status = StudentStatus.Active, Gender = StudentGender.Female, DateOfBirth = new DateTime(2005, 3, 15), Address = "TP. Hồ Chí Minh", GPA = 3.62m, CreatedAt = now.AddDays(-120), UpdatedAt = now.AddDays(-2) },
                new Student { StudentCode = "SV2023002", FullName = "Trần Hoàng Nam", Email = "nam.tran@campus.edu.vn", Phone = "0901000002", Major = "Quản trị kinh doanh", Cohort = "K23", Status = StudentStatus.Active, Gender = StudentGender.Male, DateOfBirth = new DateTime(2005, 7, 9), Address = "Đồng Nai", GPA = 3.18m, CreatedAt = now.AddDays(-110), UpdatedAt = now.AddDays(-5) },
                new Student { StudentCode = "SV2024008", FullName = "Lê Phương Thảo", Email = "thao.le@campus.edu.vn", Phone = "0901000003", Major = "Marketing", Cohort = "K24", Status = StudentStatus.Pending, Gender = StudentGender.Female, DateOfBirth = new DateTime(2006, 1, 27), Address = "Long An", GPA = 3.04m, CreatedAt = now.AddDays(-95), UpdatedAt = now.AddDays(-1) },
                new Student { StudentCode = "SV2022015", FullName = "Phạm Gia Huy", Email = "huy.pham@campus.edu.vn", Phone = "0901000004", Major = "Thiết kế đồ họa", Cohort = "K22", Status = StudentStatus.Active, Gender = StudentGender.Male, DateOfBirth = new DateTime(2004, 12, 12), Address = "TP. Hồ Chí Minh", GPA = 3.46m, CreatedAt = now.AddDays(-180), UpdatedAt = now.AddDays(-7) },
                new Student { StudentCode = "SV2023019", FullName = "Đỗ Khánh Linh", Email = "linh.do@campus.edu.vn", Phone = "0901000005", Major = "Ngôn ngữ Anh", Cohort = "K23", Status = StudentStatus.Leave, Gender = StudentGender.Female, DateOfBirth = new DateTime(2005, 8, 22), Address = "Bình Dương", GPA = 2.76m, CreatedAt = now.AddDays(-140), UpdatedAt = now.AddDays(-10) },
                new Student { StudentCode = "SV2024012", FullName = "Võ Đức Anh", Email = "ducanh.vo@campus.edu.vn", Phone = "0901000006", Major = "Tài chính - Ngân hàng", Cohort = "K24", Status = StudentStatus.Active, Gender = StudentGender.Male, DateOfBirth = new DateTime(2006, 5, 3), Address = "Tây Ninh", GPA = 3.28m, CreatedAt = now.AddDays(-75), UpdatedAt = now.AddDays(-4) },
                new Student { StudentCode = "SV2025003", FullName = "Bùi Ngọc Hà", Email = "ha.bui@campus.edu.vn", Phone = "0901000007", Major = "Công nghệ thông tin", Cohort = "K25", Status = StudentStatus.Pending, Gender = StudentGender.Female, DateOfBirth = new DateTime(2007, 6, 18), Address = "TP. Hồ Chí Minh", GPA = 3.51m, CreatedAt = now.AddDays(-35), UpdatedAt = now.AddDays(-1) },
                new Student { StudentCode = "SV2022011", FullName = "Hoàng Tuấn Kiệt", Email = "kiet.hoang@campus.edu.vn", Phone = "0901000008", Major = "Kỹ thuật phần mềm", Cohort = "K22", Status = StudentStatus.Active, Gender = StudentGender.Male, DateOfBirth = new DateTime(2004, 2, 24), Address = "Bình Phước", GPA = 3.79m, CreatedAt = now.AddDays(-210), UpdatedAt = now.AddDays(-3) }
            );
        }

        await db.SaveChangesAsync();
    }

    private static class PasswordHasher
    {
        public static string Hash(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120_000, HashAlgorithmName.SHA256, 32);
            return $"PBKDF2$120000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }
    }
}
