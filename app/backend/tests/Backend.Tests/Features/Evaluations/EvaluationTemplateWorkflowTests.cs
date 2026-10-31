using Backend.Application;
using Backend.Application.Evaluations;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Evaluations;
using FluentValidation;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

// Chạy handler thật trên repository EF Core thật (SQLite trong bộ nhớ) để kiểm tra
// cả quy tắc nghiệp vụ lẫn việc thay tiêu chí khi lưu.
public sealed class EvaluationTemplateWorkflowTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;

    public EvaluationTemplateWorkflowTests()
    {
        _connection.Open();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddDbContext<ApplicationDbContext>(o => o.UseSqlite(_connection));
        services.AddScoped<IEvaluationTemplateRepository, EvaluationTemplateRepository>();
        _provider = services.BuildServiceProvider();
        using var scope = _provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreated();
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }

    // Mỗi lần gửi dùng một scope riêng, giống một HTTP request.
    private async Task<T> Send<T>(IRequest<T> request)
    {
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    internal static EvaluationTemplateInputDto CommitteeTemplate(string name = "Phiếu thành viên hội đồng", string status = "Active") => new()
    {
        Name = name,
        Description = "Phần chấm điểm dành cho thành viên hội đồng",
        MaxScore = 10,
        Status = status,
        Criteria =
        [
            Criterion("Ý nghĩa khoa học, giá trị thực tiễn", 3, ("Tính mới và độ phức tạp", 1.5m), ("Tính thực tiễn và đóng góp", 1.5m)),
            Criterion("Vận dụng kiến thức", 3, ("Nền tảng", 1), ("Chuyên sâu", 1), ("Công cụ", 1)),
            Criterion("Trình bày kết quả", 4, ("Cuốn báo cáo", 2), ("Thuyết trình", 2))
        ]
    };

    internal static EvaluationCriterionInputDto Criterion(string name, decimal max, params (string Name, decimal Max)[] subs) => new()
    {
        Name = name,
        MaxScore = max,
        SubCriteria = subs.Select(s => new EvaluationSubCriterionInputDto { Name = s.Name, MaxScore = s.Max }).ToList()
    };

    private async Task<EvaluationTemplateDto> Create(EvaluationTemplateInputDto input)
    {
        var result = await Send(new CreateEvaluationTemplateCommand(input));
        Assert.Equal(EvaluationResultStatus.Created, result.Status);
        return result.Response.Data!;
    }

    [Fact]
    public async Task CreatesActiveTemplateKeepingCriteriaOrder()
    {
        var input = CommitteeTemplate();
        input.Criteria[0].Description = "  Đánh giá qua phần trình bày ";
        var created = await Create(input);

        var loaded = (await Send(new GetEvaluationTemplateQuery(created.Id))).Response.Data!;
        Assert.Equal("Đánh giá qua phần trình bày", loaded.Criteria[0].Description);
        Assert.Null(loaded.Criteria[1].Description);
        Assert.Equal("Active", loaded.Status);
        Assert.Equal(10, loaded.MaxScore);
        Assert.Equal(["Ý nghĩa khoa học, giá trị thực tiễn", "Vận dụng kiến thức", "Trình bày kết quả"], loaded.Criteria.Select(c => c.Name));
        Assert.Equal(["Nền tảng", "Chuyên sâu", "Công cụ"], loaded.Criteria[1].SubCriteria.Select(s => s.Name));
        Assert.Equal(1.5m, loaded.Criteria[0].SubCriteria[0].MaxScore);
    }

    [Fact]
    public async Task ActiveTemplateMustHaveMatchingTotals()
    {
        var input = CommitteeTemplate();
        input.Criteria[2].MaxScore = 3; // tổng tiêu chí chung = 9, hạng mục con của tiêu chí 3 = 4

        var ex = await Assert.ThrowsAsync<ValidationException>(() => Send(new CreateEvaluationTemplateCommand(input)));

        var messages = ex.Errors.Select(e => e.ErrorMessage).ToList();
        Assert.Contains(messages, m => m.Contains("Tổng điểm tiêu chí chung (9) phải bằng thang điểm phiếu (10)"));
        Assert.Contains(messages, m => m.Contains("Tổng điểm hạng mục con của \"Trình bày kết quả\" (4) phải bằng điểm tiêu chí (3)"));
    }

    [Fact]
    public async Task DraftMayBeIncompleteButNotDuplicated()
    {
        var draft = CommitteeTemplate(status: "Draft");
        draft.Criteria[2].MaxScore = 1;
        draft.Criteria.Add(Criterion("Câu hỏi", 1));
        Assert.Equal("Draft", (await Create(draft)).Status);

        var duplicated = CommitteeTemplate("Mẫu khác", "Draft");
        duplicated.Criteria.Add(Criterion("  trình bày KẾT QUẢ ", 1, ("A", 1)));
        duplicated.Criteria[0].SubCriteria.Add(new EvaluationSubCriterionInputDto { Name = "tính mới và độ phức tạp", MaxScore = 1 });
        var ex = await Assert.ThrowsAsync<ValidationException>(() => Send(new CreateEvaluationTemplateCommand(duplicated)));
        var messages = ex.Errors.Select(e => e.ErrorMessage).ToList();
        Assert.Contains(messages, m => m.StartsWith("Trùng tên tiêu chí chung"));
        Assert.Contains(messages, m => m.StartsWith("Trùng tên hạng mục con"));
    }

    [Theory]
    [InlineData("", 10, "Active", "Nhập tên mẫu phiếu.")]
    [InlineData("Mẫu", 0, "Active", "Thang điểm phiếu phải lớn hơn 0.")]
    [InlineData("Mẫu", 10.001, "Active", "Thang điểm phiếu tối đa hai chữ số thập phân.")]
    [InlineData("Mẫu", 10, "Closed", "Trạng thái phải là một trong: Draft, Active.")]
    [InlineData("Mẫu", 10, "2", "Trạng thái phải là một trong: Draft, Active.")]
    [InlineData("Mẫu", 10, "Active", "Mô tả tối đa 500 ký tự.", 501)]
    public async Task RejectsInvalidTemplateFields(string name, double maxScore, string status, string message, int descriptionLength = 0)
    {
        var input = CommitteeTemplate(name, status);
        if (descriptionLength > 0) input.Description = new string('a', descriptionLength);
        input.MaxScore = (decimal)maxScore;

        var ex = await Assert.ThrowsAsync<ValidationException>(() => Send(new CreateEvaluationTemplateCommand(input)));

        Assert.Contains(ex.Errors, e => e.ErrorMessage == message);
    }

    [Fact]
    public async Task RejectsDuplicateTemplateNameIgnoringCaseAndSpaces()
    {
        var first = await Create(CommitteeTemplate("Phiếu hướng dẫn"));
        await Create(CommitteeTemplate("Phiếu phản biện"));

        var created = await Send(new CreateEvaluationTemplateCommand(CommitteeTemplate("  phiếu HƯỚNG dẫn ")));
        var renamed = await Send(new UpdateEvaluationTemplateCommand(first.Id, CommitteeTemplate("Phiếu phản biện")));
        var sameName = await Send(new UpdateEvaluationTemplateCommand(first.Id, CommitteeTemplate("Phiếu hướng dẫn")));

        Assert.Equal(EvaluationResultStatus.Conflict, created.Status);
        Assert.Equal("Tên mẫu phiếu đã tồn tại. Đặt tên khác.", created.Response.Message);
        Assert.Equal(EvaluationResultStatus.Conflict, renamed.Status);
        Assert.Equal(EvaluationResultStatus.Ok, sameName.Status);
    }

    [Fact]
    public async Task UpdateReplacesCriteria()
    {
        var created = await Create(CommitteeTemplate());
        var input = CommitteeTemplate("Phiếu đã sửa");
        input.Criteria = [Criterion("Toàn bộ", 10, ("Phần A", 6), ("Phần B", 4))];

        var result = await Send(new UpdateEvaluationTemplateCommand(created.Id, input));

        Assert.Equal(EvaluationResultStatus.Ok, result.Status);
        Assert.NotNull(result.Response.Data!.UpdatedAt);
        var loaded = (await Send(new GetEvaluationTemplateQuery(created.Id))).Response.Data!;
        Assert.Equal("Phiếu đã sửa", loaded.Name);
        var criterion = Assert.Single(loaded.Criteria);
        Assert.Equal(["Phần A", "Phần B"], criterion.SubCriteria.Select(s => s.Name));
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(1, await db.EvaluationCriteria.CountAsync());
        Assert.Equal(2, await db.EvaluationSubCriteria.CountAsync());
    }

    [Fact]
    public async Task StatusTransitions()
    {
        var draft = CommitteeTemplate(status: "Draft");
        draft.Criteria[0].MaxScore = 2;
        var created = await Create(draft);

        var activateIncomplete = await Send(new ChangeEvaluationTemplateStatusCommand(created.Id, "Active"));
        Assert.Equal(EvaluationResultStatus.Invalid, activateIncomplete.Status);
        Assert.Contains(activateIncomplete.Response.Errors!, e => e.StartsWith("Tổng điểm tiêu chí chung"));

        Assert.Equal(EvaluationResultStatus.Ok, (await Send(new UpdateEvaluationTemplateCommand(created.Id, CommitteeTemplate()))).Status);
        var closed = await Send(new ChangeEvaluationTemplateStatusCommand(created.Id, "Closed"));
        Assert.Equal("Closed", closed.Response.Data!.Status);
        var backToDraft = await Send(new ChangeEvaluationTemplateStatusCommand(created.Id, "Draft"));
        Assert.Equal(EvaluationResultStatus.Invalid, backToDraft.Status);
        var reopened = await Send(new ChangeEvaluationTemplateStatusCommand(created.Id, "Active"));
        Assert.Equal("Active", reopened.Response.Data!.Status);
        // Đủ điều kiện ⇄ Nháp tự do khi chưa được gán.
        var editToDraft = await Send(new UpdateEvaluationTemplateCommand(created.Id, CommitteeTemplate(status: "Draft")));
        Assert.Equal("Draft", editToDraft.Response.Data!.Status);
        Assert.Equal("Active", (await Send(new UpdateEvaluationTemplateCommand(created.Id, CommitteeTemplate()))).Response.Data!.Status);

        // Đang được gán thì phải giữ đủ điều kiện.
        await Send(new AssignEvaluationTemplateCommand("r-vb1-hk1", "Committee", created.Id));
        var assignedToDraft = await Send(new UpdateEvaluationTemplateCommand(created.Id, CommitteeTemplate(status: "Draft")));
        Assert.Equal(EvaluationResultStatus.Invalid, assignedToDraft.Status);
        Assert.Equal(EvaluationMapping_AssignedKeepValid, assignedToDraft.Response.Message);
        var statusToDraft = await Send(new ChangeEvaluationTemplateStatusCommand(created.Id, "Draft"));
        Assert.Equal(EvaluationResultStatus.Invalid, statusToDraft.Status);
    }

    [Fact]
    public async Task AssignsOnlyActiveTemplatesAndBlocksDeletingAssignedOnes()
    {
        var active = await Create(CommitteeTemplate("Mẫu hội đồng"));
        var other = await Create(CommitteeTemplate("Mẫu hội đồng 2"));
        var draft = await Create(CommitteeTemplate("Mẫu nháp", "Draft"));

        var notActive = await Send(new AssignEvaluationTemplateCommand("r-ths-1-2026", "Committee", draft.Id));
        Assert.Equal(EvaluationResultStatus.Invalid, notActive.Status);
        var missing = await Send(new AssignEvaluationTemplateCommand("r-ths-1-2026", "Committee", Guid.NewGuid()));
        Assert.Equal(EvaluationResultStatus.NotFound, missing.Status);

        Assert.Equal(EvaluationResultStatus.Ok, (await Send(new AssignEvaluationTemplateCommand("r-ths-1-2026", "Committee", other.Id))).Status);
        var reassigned = await Send(new AssignEvaluationTemplateCommand("r-ths-1-2026", "Committee", active.Id));
        Assert.Equal("Mẫu hội đồng", reassigned.Response.Data!.TemplateName);
        await Send(new AssignEvaluationTemplateCommand("r-vb1-hk1", "Supervisor", active.Id));

        var forRound = (await Send(new GetEvaluationAssignmentsQuery("r-ths-1-2026"))).Data!;
        var only = Assert.Single(forRound);
        Assert.Equal(("Committee", active.Id, "Mẫu hội đồng"), (only.Role, only.TemplateId, only.TemplateName));
        var listed = (await Send(new GetEvaluationTemplatesQuery())).Data!.Single(t => t.Id == active.Id);
        Assert.Equal(["r-ths-1-2026:Committee", "r-vb1-hk1:Supervisor"], listed.Assignments.Select(a => $"{a.RoundId}:{a.Role}"));

        var blocked = await Send(new DeleteEvaluationTemplateCommand(active.Id));
        Assert.Equal(EvaluationResultStatus.Conflict, blocked.Status);
        Assert.Equal(DeleteEvaluationTemplateHandler.AssignedMessage, blocked.Response.Message);

        Assert.Equal(EvaluationResultStatus.Ok, (await Send(new UnassignEvaluationTemplateCommand("r-ths-1-2026", "Committee"))).Status);
        Assert.Equal(EvaluationResultStatus.NotFound, (await Send(new UnassignEvaluationTemplateCommand("r-ths-1-2026", "Committee"))).Status);
        Assert.Equal(EvaluationResultStatus.Ok, (await Send(new UnassignEvaluationTemplateCommand("r-vb1-hk1", "Supervisor"))).Status);
        Assert.Equal(EvaluationResultStatus.Ok, (await Send(new DeleteEvaluationTemplateCommand(active.Id))).Status);
        Assert.Equal(EvaluationResultStatus.NotFound, (await Send(new GetEvaluationTemplateQuery(active.Id))).Status);
        Assert.Equal(EvaluationResultStatus.NotFound, (await Send(new DeleteEvaluationTemplateCommand(active.Id))).Status);
    }

    [Fact]
    public async Task DeletesAssignedTemplateWhenRemovalIsConfirmed()
    {
        var template = await Create(CommitteeTemplate("Mẫu gỡ gán"));
        var kept = await Create(CommitteeTemplate("Mẫu giữ lại"));
        await Send(new AssignEvaluationTemplateCommand("r-vb1-hk1", "Committee", template.Id));
        await Send(new AssignEvaluationTemplateCommand("r-vb2-hk1", "Reviewer", template.Id));
        await Send(new AssignEvaluationTemplateCommand("r-vb1-hk1", "Supervisor", kept.Id));

        var result = await Send(new DeleteEvaluationTemplateCommand(template.Id, RemoveAssignments: true));

        Assert.Equal(EvaluationResultStatus.Ok, result.Status);
        Assert.Equal("Đã gỡ gán và xóa mẫu phiếu", result.Response.Message);
        Assert.Equal(EvaluationResultStatus.NotFound, (await Send(new GetEvaluationTemplateQuery(template.Id))).Status);
        var remaining = Assert.Single((await Send(new GetEvaluationAssignmentsQuery(null))).Data!);
        Assert.Equal(kept.Id, remaining.TemplateId);
    }

    private const string EvaluationMapping_AssignedKeepValid = "Mẫu đang được sử dụng nên phải giữ đủ điều kiện. Gỡ gán mẫu trước khi sửa về nháp.";

    [Fact]
    public async Task DraftMayHaveZeroScoresButActiveMayNot()
    {
        var input = CommitteeTemplate("Mẫu mới", "Draft");
        input.Criteria = [Criterion("Tiêu chí 1", 0, ("Hạng mục 1.1", 0))];
        Assert.Equal("Draft", (await Create(input)).Status);

        input.Name = "Mẫu mới 2";
        input.Status = "Active";
        var ex = await Assert.ThrowsAsync<ValidationException>(() => Send(new CreateEvaluationTemplateCommand(input)));
        Assert.Contains(ex.Errors, e => e.ErrorMessage.Contains("phải lớn hơn 0"));

        input.Name = "Mẫu âm";
        input.Status = "Draft";
        input.Criteria[0].MaxScore = -1;
        var negative = await Assert.ThrowsAsync<ValidationException>(() => Send(new CreateEvaluationTemplateCommand(input)));
        Assert.Contains(negative.Errors, e => e.ErrorMessage == "Điểm tiêu chí chung không được âm.");
    }

    [Fact]
    public async Task DraftCanBeActivatedByStatusChange()
    {
        var draft = await Create(CommitteeTemplate("Mẫu nháp hoàn chỉnh", "Draft"));

        var result = await Send(new ChangeEvaluationTemplateStatusCommand(draft.Id, "Active"));

        Assert.Equal(EvaluationResultStatus.Ok, result.Status);
        Assert.Equal("Active", result.Response.Data!.Status);
    }

    [Theory]
    [InlineData("r 1", "Committee", "Mã đợt không hợp lệ.")]
    [InlineData("r-1", "Chair", "Vai trò chấm phải là Supervisor, Reviewer hoặc Committee.")]
    [InlineData("r-1", "1", "Vai trò chấm phải là Supervisor, Reviewer hoặc Committee.")]
    public async Task RejectsInvalidAssignmentKeys(string roundId, string role, string message)
    {
        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            Send(new AssignEvaluationTemplateCommand(roundId, role, Guid.NewGuid())));

        Assert.Contains(ex.Errors, e => e.ErrorMessage == message);
    }
}

public sealed class ThesisScoreTests
{
    [Theory]
    [InlineData(7.05, 8, 8.5, 8.5, 8.18)] // 49,05 / 6 = 8,175 → làm tròn nửa lên
    [InlineData(10, 10, 10, 10, 10)]
    [InlineData(6, 7, 8, 9, 7.83)]
    public void CalculatesThesisScoreRoundingHalfAwayFromZero(double chair, double secretary, double supervisor, double reviewer, double expected) =>
        Assert.Equal((decimal)expected, ThesisScore.Calculate((decimal)chair, (decimal)secretary, (decimal)supervisor, (decimal)reviewer));

    [Fact]
    public void ConvertsTemplateScoreToScale10()
    {
        Assert.Equal(8.5m, ThesisScore.ToScale10(8.5m, 10));
        Assert.Equal(8.5m, ThesisScore.ToScale10(85, 100));
        Assert.Throws<ArgumentOutOfRangeException>(() => ThesisScore.ToScale10(5, 0));
    }
}
