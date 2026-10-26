using System.Text;
using Backend.Application;
using Backend.Application.Common;
using Backend.Application.Common.Security;
using Backend.Application.Users;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class UserImportTests
{
    private const string Header = "user_code,full_name,email,role,date_of_birth,class_name,department,academic_title";
    private readonly InMemoryUserRepository _users = new();
    private readonly ISender _sender;

    public UserImportTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddSingleton<IUserRepository>(_users);
        services.AddSingleton<IPasswordHasher, FakePasswordHasher>();
        _sender = services.BuildServiceProvider().GetRequiredService<ISender>();
    }

    [Fact]
    public async Task PreviewParsesValidRowsOfEveryRoleWithoutSaving()
    {
        var report = await Preview(
            "22520001,Nguyễn Văn An,An.NV@Truong.edu.vn,Student,2004-05-01,KTPM2022,,",
            "GV0001,Trần Thị Bình,binh@truong.edu.vn,Giảng viên,15/03/1985,,Công nghệ phần mềm,TS",
            "GVU0001,Lê Văn Cường,cuong@truong.edu.vn,giaovu,,,,");

        Assert.True(report.Success);
        Assert.Equal(3, report.Data!.TotalRows);
        Assert.Equal(3, report.Data.ValidRows);
        Assert.Equal(0, report.Data.ImportedRows);
        Assert.All(report.Data.Rows, r => Assert.Empty(r.Errors));
        var student = report.Data.Rows[0];
        Assert.Equal(2, student.RowNumber);
        Assert.Equal("an.nv@truong.edu.vn", student.Email);
        Assert.Equal("Student", student.Role);
        Assert.Equal(new DateOnly(2004, 5, 1), student.DateOfBirth);
        Assert.Equal("Lecturer", report.Data.Rows[1].Role);
        Assert.Equal(new DateOnly(1985, 3, 15), report.Data.Rows[1].DateOfBirth);
        Assert.Equal("AcademicAffairs", report.Data.Rows[2].Role);
        Assert.Empty(_users.All());
    }

    [Theory]
    [InlineData(",Nguyễn Văn An,an@truong.edu.vn,Student,,KTPM2022,,", "Thiếu mã người dùng")]
    [InlineData("22520001,,an@truong.edu.vn,Student,,KTPM2022,,", "Thiếu họ tên")]
    [InlineData("22520001,Nguyễn Văn An,,Student,,KTPM2022,,", "Thiếu email")]
    [InlineData("22520001,Nguyễn Văn An,khong-phai-email,Student,,KTPM2022,,", "Email không hợp lệ")]
    [InlineData("22520001,Nguyễn Văn An,an@truong.edu.vn,,,KTPM2022,,", "Thiếu vai trò")]
    [InlineData("22520001,Nguyễn Văn An,an@truong.edu.vn,Admin,,KTPM2022,,", "Vai trò không hợp lệ")]
    [InlineData("22520001,Nguyễn Văn An,an@truong.edu.vn,Student,,,,", "Sinh viên phải có lớp")]
    [InlineData("GV0001,Trần Thị Bình,binh@truong.edu.vn,Lecturer,,,,TS", "Giảng viên phải có bộ môn")]
    [InlineData("22520001,Nguyễn Văn An,an@truong.edu.vn,Student,31/02/2004,KTPM2022,,", "Ngày sinh không hợp lệ")]
    public async Task PreviewReportsRowErrors(string row, string expectedError)
    {
        var report = await Preview(row);

        var reported = Assert.Single(report.Data!.Rows);
        Assert.Contains(reported.Errors, e => e.StartsWith(expectedError));
        Assert.Equal(1, report.Data.ErrorRows);
        Assert.Equal(0, report.Data.ValidRows);
    }

    [Fact]
    public async Task PreviewReportsDuplicatesInsideTheFile()
    {
        var report = await Preview(
            "22520001,Nguyễn Văn An,an@truong.edu.vn,Student,,KTPM2022,,",
            "22520001,Nguyễn Văn Ba,ba@truong.edu.vn,Student,,KTPM2022,,",
            "22520003,Nguyễn Văn Ca,AN@truong.edu.vn,Student,,KTPM2022,,");

        Assert.Empty(report.Data!.Rows[0].Errors);
        Assert.Contains(report.Data.Rows[1].Errors, e => e.Contains("Trùng mã người dùng với dòng 2"));
        Assert.Contains(report.Data.Rows[2].Errors, e => e.Contains("Trùng email với dòng 2"));
    }

    [Fact]
    public async Task PreviewReportsCodesAndEmailsThatAlreadyExist()
    {
        _users.Add("22520001", "an@truong.edu.vn", "x", UserRole.Student, mustChange: false);

        var report = await Preview(
            "22520001,Nguyễn Văn An,moi@truong.edu.vn,Student,,KTPM2022,,",
            "22520002,Nguyễn Văn Ba,AN@truong.edu.vn,Student,,KTPM2022,,");

        Assert.Contains(report.Data!.Rows[0].Errors, e => e == "Mã người dùng đã tồn tại");
        Assert.Contains(report.Data.Rows[1].Errors, e => e == "Email đã tồn tại");
    }

    [Fact]
    public async Task ImportCreatesOnlyValidRowsAsAccountsThatMustActivate()
    {
        var report = await Import(
            "22520001,Nguyễn Văn An,An@Truong.edu.vn,Student,2004-05-01,KTPM2022,,",
            "22520002,,ba@truong.edu.vn,Student,,KTPM2022,,",
            "GV0001,Trần Thị Bình,binh@truong.edu.vn,Lecturer,,,Công nghệ phần mềm,TS");

        Assert.True(report.Success);
        Assert.Equal(2, report.Data!.ImportedRows);
        Assert.Equal(1, report.Data.ErrorRows);
        var users = _users.All().OrderBy(u => u.UserCode).ToList();
        Assert.Equal(["22520001", "GV0001"], users.Select(u => u.UserCode));
        var student = users[0];
        Assert.Equal("an@truong.edu.vn", student.Email);
        Assert.Equal(UserRole.Student, student.Role);
        Assert.Equal("KTPM2022", student.ClassName);
        Assert.Equal(new DateOnly(2004, 5, 1), student.DateOfBirth);
        Assert.True(student.MustChangePassword);
        Assert.True(student.IsActive);
        Assert.Equal("hash:22520001", student.PasswordHash);
        Assert.Equal("Công nghệ phần mềm", users[1].Department);
        Assert.Equal("TS", users[1].AcademicTitle);
    }

    [Fact]
    public async Task ImportWithNoValidRowsSavesNothing()
    {
        var report = await Import("22520001,,an@truong.edu.vn,Student,,KTPM2022,,");

        Assert.True(report.Success);
        Assert.Equal(0, report.Data!.ImportedRows);
        Assert.Empty(_users.All());
    }

    [Fact]
    public async Task ParsesQuotedFieldsBomCrlfAndAnyColumnOrder()
    {
        var csv = "﻿email,role,user_code,full_name,class_name\r\n" +
                  "an@truong.edu.vn,Student,22520001,\"Nguyễn, Văn \"\"An\"\"\",KTPM2022\r\n";

        var report = await _sender.Send(new ImportUsersCommand(Encoding.UTF8.GetBytes(csv), "ds.csv", Commit: false));

        var row = Assert.Single(report.Data!.Rows);
        Assert.Empty(row.Errors);
        Assert.Equal("Nguyễn, Văn \"An\"", row.FullName);
    }

    [Fact]
    public async Task SkipsBlankLines()
    {
        var report = await Preview("22520001,Nguyễn Văn An,an@truong.edu.vn,Student,,KTPM2022,,", "", "  ");

        Assert.Equal(1, report.Data!.TotalRows);
    }

    [Theory]
    [InlineData("ds.xlsx", "user_code,full_name,email,role\n1,A,a@b.vn,Student", "Tệp phải có đuôi .csv")]
    [InlineData("ds.csv", "", "Tệp CSV trống")]
    [InlineData("ds.csv", "user_code,full_name,role\n1,A,Student", "Thiếu cột bắt buộc: email")]
    [InlineData("ds.csv", "user_code,full_name,email,role", "Tệp không có dòng dữ liệu")]
    [InlineData("ds.csv", "user_code,full_name,email,role\n1,\"A,a@b.vn,Student", "Tệp CSV không đúng định dạng")]
    public async Task RejectsInvalidFiles(string fileName, string content, string expectedMessage)
    {
        var report = await _sender.Send(new ImportUsersCommand(Encoding.UTF8.GetBytes(content), fileName, Commit: false));

        Assert.False(report.Success);
        Assert.StartsWith(expectedMessage, report.Message);
    }

    [Fact]
    public async Task RejectsFilesThatAreNotUtf8()
    {
        var latin1 = Encoding.Latin1.GetBytes("user_code,full_name,email,role,class_name\n1,Nguyên,a@b.vn,Student,K");

        var report = await _sender.Send(new ImportUsersCommand(latin1, "ds.csv", Commit: false));

        Assert.False(report.Success);
        Assert.StartsWith("Tệp phải được lưu dạng CSV UTF-8", report.Message);
    }

    [Fact]
    public async Task RejectsFilesWithTooManyRows()
    {
        var rows = Enumerable.Range(1, UserImportPolicy.MaxRows + 1)
            .Select(i => $"SV{i},Tên {i},sv{i}@truong.edu.vn,Student,,K,,");

        var report = await Preview(rows.ToArray());

        Assert.False(report.Success);
        Assert.StartsWith($"Tệp vượt quá {UserImportPolicy.MaxRows} dòng", report.Message);
    }

    [Fact]
    public async Task RejectsFilesThatAreTooLarge()
    {
        var report = await _sender.Send(new ImportUsersCommand(new byte[UserImportPolicy.MaxFileBytes + 1], "ds.csv", Commit: false));

        Assert.False(report.Success);
        Assert.StartsWith("Tệp vượt quá", report.Message);
    }

    private Task<ApiResponse<UserImportReportDto>> Preview(params string[] rows) => Send(rows, commit: false);
    private Task<ApiResponse<UserImportReportDto>> Import(params string[] rows) => Send(rows, commit: true);

    private Task<ApiResponse<UserImportReportDto>> Send(string[] rows, bool commit) =>
        _sender.Send(new ImportUsersCommand(Encoding.UTF8.GetBytes(string.Join('\n', [Header, .. rows])), "ds.csv", commit));
}
