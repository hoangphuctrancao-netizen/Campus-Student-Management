using Campus.StudentManagement.Models;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Data;

public class CampusDbContext(DbContextOptions<CampusDbContext> options) : DbContext(options)
{
    public DbSet<Student> Students => Set<Student>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Student>()
            .Property(x => x.GPA)
            .HasDefaultValue(0m);

        modelBuilder.Entity<AuditLog>()
            .Property(x => x.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        modelBuilder.Entity<AdminUser>()
            .HasIndex(x => x.Email)
            .IsUnique();
    }
}
