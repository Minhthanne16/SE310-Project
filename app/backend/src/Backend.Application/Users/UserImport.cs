using System.Globalization;
using System.Net.Mail;
using System.Text;
using System.Text.RegularExpressions;
using Backend.Application.Common;
using Backend.Application.Common.Security;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;

namespace Backend.Application.Users;

// Giới hạn kỹ thuật của tệp nhập (PDR-004), không phải chỉ tiêu phi chức năng.
public static class UserImportPolicy
{
    public const int MaxFileBytes = 2 * 1024 * 1024;
    public const int MaxRows = 2000;
}

// Commit=false: chỉ kiểm tra và xem trước. Commit=true: kiểm tra lại rồi tạo các dòng hợp lệ.
public record ImportUsersCommand(byte[] Content, string FileName, bool Commit) : IRequest<ApiResponse<UserImportReportDto>>;

public sealed partial class ImportUsersHandler(IUserRepository users, IPasswordHasher hasher)
    : IRequestHandler<ImportUsersCommand, ApiResponse<UserImportReportDto>>
{
    private static readonly string[] RequiredColumns = ["user_code", "full_name", "email", "role"];
    private static readonly string[] DateFormats = ["yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy"];

    private static readonly Dictionary<string, UserRole> RoleAliases = new()
    {
        ["student"] = UserRole.Student, ["sinhviên"] = UserRole.Student, ["sinhvien"] = UserRole.Student, ["sv"] = UserRole.Student,
        ["lecturer"] = UserRole.Lecturer, ["giảngviên"] = UserRole.Lecturer, ["giangvien"] = UserRole.Lecturer, ["gv"] = UserRole.Lecturer,
        ["academicaffairs"] = UserRole.AcademicAffairs, ["giáovụ"] = UserRole.AcademicAffairs, ["giaovu"] = UserRole.AcademicAffairs
    };

    [GeneratedRegex("^[A-Za-z0-9._-]+$")]
    private static partial Regex UserCodePattern();

    private sealed record ParsedRow(UserImportRowDto Dto, UserRole? Role);

    public async Task<ApiResponse<UserImportReportDto>> Handle(ImportUsersCommand request, CancellationToken cancellationToken)
    {
        if (!request.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            return Fail("Tệp phải có đuôi .csv");
        if (request.Content.Length > UserImportPolicy.MaxFileBytes)
            return Fail($"Tệp vượt quá {UserImportPolicy.MaxFileBytes / (1024 * 1024)} MB");

        string text;
        try
        {
            text = new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(request.Content);
        }
        catch (DecoderFallbackException)
        {
            return Fail("Tệp phải được lưu dạng CSV UTF-8 (trong Excel: Lưu thành › CSV UTF-8)");
        }
        text = text.TrimStart('﻿').Normalize(NormalizationForm.FormC);
        if (string.IsNullOrWhiteSpace(text)) return Fail("Tệp CSV trống");

        List<List<string>> records;
        try
        {
            records = CsvReader.Parse(text);
        }
        catch (FormatException ex)
        {
            return Fail($"Tệp CSV không đúng định dạng: {ex.Message}");
        }

        var columns = records[0]
            .Select((name, index) => (Name: name.Trim().ToLowerInvariant(), Index: index))
            .Where(c => c.Name.Length > 0)
            .GroupBy(c => c.Name)
            .ToDictionary(g => g.Key, g => g.First().Index);
        var missing = RequiredColumns.Where(c => !columns.ContainsKey(c)).ToList();
        if (missing.Count > 0) return Fail($"Thiếu cột bắt buộc: {string.Join(", ", missing)}");

        var dataRecords = records
            .Select((fields, index) => (Fields: fields, RowNumber: index + 1))
            .Skip(1)
            .Where(r => r.Fields.Any(f => !string.IsNullOrWhiteSpace(f)))
            .ToList();
        if (dataRecords.Count == 0) return Fail("Tệp không có dòng dữ liệu");
        if (dataRecords.Count > UserImportPolicy.MaxRows)
            return Fail($"Tệp vượt quá {UserImportPolicy.MaxRows} dòng dữ liệu");

        var rows = dataRecords.Select(r => ParseRow(r.Fields, r.RowNumber, columns)).ToList();
        await MarkDuplicatesAsync(rows, cancellationToken);

        var validRows = rows.Where(r => r.Dto.Errors.Count == 0).ToList();
        var report = new UserImportReportDto
        {
            TotalRows = rows.Count,
            ValidRows = validRows.Count,
            ErrorRows = rows.Count - validRows.Count,
            Rows = rows.Select(r => r.Dto).ToList()
        };

        if (!request.Commit)
            return ApiResponse<UserImportReportDto>.Ok(report,
                $"Đã kiểm tra tệp: {report.ValidRows} dòng hợp lệ, {report.ErrorRows} dòng lỗi");

        if (validRows.Count > 0)
        {
            var hashes = new string[validRows.Count];
            Parallel.For(0, validRows.Count, i => hashes[i] = hasher.HashInitialPassword(validRows[i].Dto.UserCode));
            var newUsers = validRows.Select((r, i) => new User
            {
                UserCode = r.Dto.UserCode,
                FullName = r.Dto.FullName,
                Email = r.Dto.Email,
                Role = r.Role!.Value,
                DateOfBirth = r.Dto.DateOfBirth,
                ClassName = r.Dto.ClassName,
                Department = r.Dto.Department,
                AcademicTitle = r.Dto.AcademicTitle,
                PasswordHash = hashes[i],
                MustChangePassword = true,
                IsActive = true
            }).ToList();
            await users.AddRangeAsync(newUsers, cancellationToken);
        }

        report.ImportedRows = validRows.Count;
        return ApiResponse<UserImportReportDto>.Ok(report,
            $"Đã tạo {report.ImportedRows} tài khoản, bỏ qua {report.ErrorRows} dòng lỗi");
    }

    private static ParsedRow ParseRow(List<string> fields, int rowNumber, Dictionary<string, int> columns)
    {
        string Get(string column) =>
            columns.TryGetValue(column, out var i) && i < fields.Count ? fields[i].Trim() : string.Empty;
        static string? Optional(string value) => value.Length == 0 ? null : value;

        var errors = new List<string>();
        var dto = new UserImportRowDto
        {
            RowNumber = rowNumber,
            UserCode = Get("user_code"),
            FullName = Get("full_name"),
            Email = User.NormalizeEmail(Get("email")),
            ClassName = Optional(Get("class_name")),
            Department = Optional(Get("department")),
            AcademicTitle = Optional(Get("academic_title")),
            Errors = errors
        };

        if (dto.UserCode.Length == 0) errors.Add("Thiếu mã người dùng");
        else if (dto.UserCode.Length > 50 || !UserCodePattern().IsMatch(dto.UserCode))
            errors.Add("Mã người dùng không hợp lệ (tối đa 50 ký tự gồm chữ, số, '.', '-', '_')");

        if (dto.FullName.Length == 0) errors.Add("Thiếu họ tên");
        else if (dto.FullName.Length > 200) errors.Add("Họ tên quá 200 ký tự");

        if (dto.Email.Length == 0) errors.Add("Thiếu email");
        else if (dto.Email.Length > 256 || !MailAddress.TryCreate(dto.Email, out var address) || address.Address != dto.Email)
            errors.Add("Email không hợp lệ");

        var rawRole = Get("role");
        UserRole? role = null;
        if (rawRole.Length == 0) errors.Add("Thiếu vai trò");
        else if (RoleAliases.TryGetValue(rawRole.ToLowerInvariant().Replace(" ", ""), out var parsedRole)) role = parsedRole;
        else errors.Add($"Vai trò không hợp lệ: {rawRole} (dùng Student, Lecturer hoặc AcademicAffairs)");
        dto.Role = role?.ToString() ?? rawRole;

        if (role == UserRole.Student && dto.ClassName is null) errors.Add("Sinh viên phải có lớp (class_name)");
        if (role == UserRole.Lecturer && dto.Department is null) errors.Add("Giảng viên phải có bộ môn (department)");
        foreach (var (value, label) in new[] { (dto.ClassName, "Lớp"), (dto.Department, "Bộ môn"), (dto.AcademicTitle, "Học hàm/học vị") })
            if (value is { Length: > 100 }) errors.Add($"{label} quá 100 ký tự");

        var rawDate = Get("date_of_birth");
        if (rawDate.Length > 0)
        {
            if (DateOnly.TryParseExact(rawDate, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                dto.DateOfBirth = date;
            else
                errors.Add("Ngày sinh không hợp lệ (dùng yyyy-MM-dd hoặc dd/MM/yyyy)");
        }

        return new ParsedRow(dto, role);
    }

    private async Task MarkDuplicatesAsync(List<ParsedRow> rows, CancellationToken cancellationToken)
    {
        var firstCode = new Dictionary<string, int>();
        var firstEmail = new Dictionary<string, int>();
        foreach (var row in rows.Select(r => r.Dto))
        {
            if (row.UserCode.Length > 0 && !firstCode.TryAdd(row.UserCode, row.RowNumber))
                row.Errors.Add($"Trùng mã người dùng với dòng {firstCode[row.UserCode]}");
            if (row.Email.Length > 0 && !firstEmail.TryAdd(row.Email, row.RowNumber))
                row.Errors.Add($"Trùng email với dòng {firstEmail[row.Email]}");
        }

        var existingCodes = await users.GetExistingUserCodesAsync(firstCode.Keys, cancellationToken);
        var existingEmails = await users.GetExistingEmailsAsync(firstEmail.Keys, cancellationToken);
        foreach (var row in rows.Select(r => r.Dto))
        {
            if (existingCodes.Contains(row.UserCode)) row.Errors.Add("Mã người dùng đã tồn tại");
            if (existingEmails.Contains(row.Email)) row.Errors.Add("Email đã tồn tại");
        }
    }

    private static ApiResponse<UserImportReportDto> Fail(string message) => ApiResponse<UserImportReportDto>.Fail(message);
}
