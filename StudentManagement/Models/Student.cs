using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Campus.StudentManagement.Models;

public enum StudentStatus
{
    Active,
    Pending,
    Leave,
    Graduated
}

public enum StudentGender
{
    Male,
    Female,
    Other
}

[Index(nameof(StudentCode), IsUnique = true)]
public class Student
{
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string StudentCode { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Major { get; set; } = string.Empty;

    [Required, MaxLength(10)]
    public string Cohort { get; set; } = string.Empty;

    public StudentStatus Status { get; set; } = StudentStatus.Active;
    public StudentGender Gender { get; set; } = StudentGender.Other;
    public DateTime? DateOfBirth { get; set; }

    [MaxLength(250)]
    public string Address { get; set; } = string.Empty;

    [Precision(4, 2)]
    public decimal GPA { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
