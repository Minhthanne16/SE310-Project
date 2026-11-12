using Backend.Application;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Topics;
using FluentValidation;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

// P03-S01: ma trận quyền – trạng thái – trường sửa của đề tài giảng viên, công bố và
// xem của sinh viên, trên repository EF Core thật (SQLite trong bộ nhớ).
public sealed class TopicWorkflowTests : IDisposable
{
    // Mốc "GV gửi đề tài" 2026-09-01..06, "SV đăng ký" 2026-09-08..13 (Dated()).
    private static readonly DateTimeOffset BeforeSubmission = new(2026, 8, 30, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset AfterRegistration = new(2026, 9, 14, 3, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);

    public TopicWorkflowTests()
    {
        _connection.Open();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(_clock);
        services.AddApplicationServices();
        services.AddDbContext<ApplicationDbContext>(o => o.UseSqlite(_connection));
        services.AddScoped<IRoundRepository, RoundRepository>();
        services.AddScoped<ITopicRepository, TopicRepository>();
        services.AddScoped<IGroupRepository, GroupRepository>();
        services.AddScoped<IOutlineRepository, OutlineRepository>();
        _provider = services.BuildServiceProvider();
        using var scope = _provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreated();
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }

    private async Task<T> Send<T>(IRequest<T> request)
    {
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private async Task<Guid> Seed(UserRole role, string code)
    {
        using var scope = _provider.CreateScope();
        return await RoundWorkflowTests.SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM");
    }

    private sealed record World(
        Guid RoundId,
        Guid Lecturer,
        Guid OtherLecturer,
        Guid Student,
        Guid Partner,
        string PartnerCode,
        Guid Outsider);

    // Đợt đang diễn ra có hai GV, một SV; thêm một GV và một SV không thuộc đợt.
    private async Task<World> OpenRound(int loadMin = 0, int loadMax = 0)
    {
        var suffix = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var lecturer = await Seed(UserRole.Lecturer, $"GV{suffix}A");
        var other = await Seed(UserRole.Lecturer, $"GV{suffix}B");
        var studentCode = $"SV{suffix}A";
        var partnerCode = $"SV{suffix}B";
        var student = await Seed(UserRole.Student, studentCode);
        var partner = await Seed(UserRole.Student, partnerCode);
        var outsider = await Seed(UserRole.Lecturer, $"GV{suffix}C");
        var created = (await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = $"Đợt đề tài {suffix}", Program = "Văn bằng 1", PeriodLabel = "HK1"
        }))).Response.Data!;
        if (loadMax > 0)
            await Send(new UpdateRoundCommand(created.Id, new RoundInfoDto
            {
                Name = created.Name, Program = created.Program, PeriodLabel = created.PeriodLabel,
                LecturerLoadMin = loadMin, LecturerLoadMax = loadMax
            }));
        await Send(new UpdateRoundMilestonesCommand(created.Id, Dated()));
        await Send(new AddParticipantsCommand(created.Id, "lecturers", [$"GV{suffix}A", $"GV{suffix}B"]));
        await Send(new AddParticipantsCommand(created.Id, "students", [studentCode, partnerCode]));
        var opened = await Send(new OpenRoundCommand(created.Id));
        Assert.Equal(RoundResultStatus.Ok, opened.Status);
        return new World(created.Id, lecturer, other, student, partner, partnerCode, outsider);
    }

    private static RoundMilestonesInputDto Dated()
    {
        var start = new DateOnly(2026, 9, 1);
        return new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select((key, i) => new RoundMilestoneInputDto
            {
                Key = RoundRules.KeyName(key),
                StartDate = start.AddDays(i * 7).ToString("yyyy-MM-dd"),
                EndDate = start.AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
                NotifyAudience = "Tất cả",
                AllowLate = ThesisRound.HasLateToggle(key) ? true : null,
                // PDR-041: mốc bật nộp trễ phải có hạn trễ sau hạn thường.
                LateEndDate = ThesisRound.HasLateToggle(key) ? start.AddDays(i * 7 + 6).ToString("yyyy-MM-dd") : null
            }).ToList()
        };
    }

    private static TopicInputDto Input(Guid roundId, string title = "Hệ thống gợi ý khóa học") => new()
    {
        RoundId = roundId,
        Title = $"  {title}  ",
        Field = "Trí tuệ nhân tạo",
        Description = "Xây dựng hệ thống gợi ý dựa trên lịch sử học tập.",
        Requirements = "Biết Python"
    };

    private async Task<TopicDto> Submit(World w, Guid? lecturer = null, string title = "Hệ thống gợi ý khóa học")
    {
        var result = await Send(new CreateTopicCommand(lecturer ?? w.Lecturer, Input(w.RoundId, title)));
        Assert.Equal(TopicResultStatus.Created, result.Status);
        return result.Response.Data!;
    }

    // Đồng hồ chạy thêm một phút để lịch sử công bố đứng sau lịch sử gửi.
    private Task<RoundResult<RoundDto>> Publish(World w)
    {
        _clock.Advance(TimeSpan.FromMinutes(1));
        return Send(new PublishRoundTopicsCommand(w.RoundId));
    }

    private static TopicInputDto Edit(TopicDto t, Action<TopicInputDto> change)
    {
        var input = new TopicInputDto
        {
            RoundId = t.RoundId, Title = t.Title, Field = t.Field, Description = t.Description, Requirements = t.Requirements
        };
        change(input);
        return input;
    }

    [Fact]
    public async Task LecturerSubmitsATopicWithCodeHistoryAndFullEditRightsBeforePublishing()
    {
        var w = await OpenRound();

        var topic = await Submit(w);

        Assert.Equal("DT-001", topic.Code);
        Assert.Equal("Hệ thống gợi ý khóa học", topic.Title);
        Assert.Equal("Chưa đăng ký", topic.Status);
        Assert.Equal("GV công bố", topic.Source);
        Assert.Equal(w.Lecturer, topic.Supervisor.Id);
        Assert.Equal("all", topic.CanEdit);
        Assert.True(topic.CanDelete);
        Assert.Equal("DT-002", (await Submit(w, title: "Đề tài thứ hai")).Code);

        var detail = (await Send(new GetTopicQuery(topic.Id, w.Lecturer, ViewerRole.Lecturer))).Response.Data!;
        var created = Assert.Single(detail.History);
        Assert.Equal("Gửi đề tài", created.Action);
        Assert.StartsWith("Người GV", created.Actor);
    }

    [Fact]
    public async Task FieldsAreRequiredAndBounded()
    {
        var w = await OpenRound();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => Send(new CreateTopicCommand(w.Lecturer,
            new TopicInputDto { RoundId = w.RoundId, Title = " ", Field = "", Description = "", Requirements = new string('x', 2001) })));
        var messages = ex.Errors.Select(e => e.ErrorMessage).ToList();
        Assert.Contains("Nhập tên đề tài.", messages);
        Assert.Contains("Chọn lĩnh vực.", messages);
        Assert.Contains("Nhập mô tả đề tài.", messages);
        Assert.Contains("Yêu cầu tối đa 2000 ký tự.", messages);
    }

    [Fact]
    public async Task OnlyLecturersOfARunningRoundSubmitFromTheStartOfTheSubmissionMilestone()
    {
        var w = await OpenRound();

        Assert.Equal(TopicResultStatus.Forbidden, (await Send(new CreateTopicCommand(w.Outsider, Input(w.RoundId)))).Status);

        _clock.Set(BeforeSubmission);
        var early = await Send(new CreateTopicCommand(w.Lecturer, Input(w.RoundId)));
        Assert.Equal(TopicResultStatus.Conflict, early.Status);
        Assert.Equal("Chưa đến thời gian gửi đề tài (từ 01/09/2026).", early.Response.Message);

        // Hết hạn gửi nhưng chưa công bố: vẫn thêm/sửa/xóa tự do (DESIGN · Đề tài của tôi).
        _clock.Set(new DateTimeOffset(2026, 9, 7, 3, 0, 0, TimeSpan.Zero));
        Assert.Equal(TopicResultStatus.Created, (await Send(new CreateTopicCommand(w.Lecturer, Input(w.RoundId)))).Status);

        await Send(new FinishRoundCommand(w.RoundId));
        // Đợt còn đề tài chưa kết thúc nên không kết thúc được (PDR-031).
        var finished = await Send(new GetRoundQuery(w.RoundId, null));
        Assert.Equal("Đang diễn ra", finished.Response.Data!.Status);
    }

    [Fact]
    public async Task OnlyTheSupervisorEditsOrDeletesTheTopic()
    {
        var w = await OpenRound();
        var topic = await Submit(w);

        var edit = await Send(new UpdateTopicCommand(w.OtherLecturer, topic.Id, Edit(topic, i => i.Title = "Đổi tên")));
        var delete = await Send(new DeleteTopicCommand(w.OtherLecturer, topic.Id));

        Assert.Equal(TopicResultStatus.Forbidden, edit.Status);
        Assert.Equal(TopicResultStatus.Forbidden, delete.Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new DeleteTopicCommand(w.Lecturer, Guid.NewGuid()))).Status);
    }

    [Fact]
    public async Task BeforePublishingEveryFieldCanChangeAndHistoryKeepsBeforeAndAfter()
    {
        var w = await OpenRound();
        var topic = await Submit(w);
        _clock.Advance(TimeSpan.FromMinutes(1));

        var result = await Send(new UpdateTopicCommand(w.Lecturer, topic.Id, Edit(topic, i =>
        {
            i.Title = "Tên mới";
            i.Field = "Khoa học dữ liệu";
        })));

        Assert.Equal(TopicResultStatus.Ok, result.Status);
        Assert.Equal("Tên mới", result.Response.Data!.Title);
        var history = (await Send(new GetTopicQuery(topic.Id, w.Lecturer, ViewerRole.Lecturer))).Response.Data!.History;
        Assert.Equal("Sửa đề tài", history[0].Action);
        Assert.Contains("Tên đề tài: Hệ thống gợi ý khóa học → Tên mới", history[0].Detail);
        Assert.Contains("Lĩnh vực: Trí tuệ nhân tạo → Khoa học dữ liệu", history[0].Detail);

        // Không đổi gì thì không ghi thêm lịch sử.
        await Send(new UpdateTopicCommand(w.Lecturer, topic.Id, Edit(result.Response.Data!, _ => { })));
        Assert.Equal(2, (await Send(new GetTopicQuery(topic.Id, w.Lecturer, ViewerRole.Lecturer))).Response.Data!.History.Count);

        Assert.Equal(TopicResultStatus.Ok, (await Send(new DeleteTopicCommand(w.Lecturer, topic.Id))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetTopicQuery(topic.Id, w.Lecturer, ViewerRole.Lecturer))).Status);
    }

    [Fact]
    public async Task PublishingNeedsAtLeastOneTopicAndRecordsHistory()
    {
        var w = await OpenRound();

        var empty = await Publish(w);
        Assert.Equal(RoundResultStatus.Conflict, empty.Status);
        Assert.Equal("Đợt chưa có đề tài nào để công bố.", empty.Response.Message);

        var topic = await Submit(w);
        Assert.Equal(RoundResultStatus.Ok, (await Publish(w)).Status);

        var history = (await Send(new GetTopicQuery(topic.Id, Guid.Empty, ViewerRole.AcademicAffairs))).Response.Data!.History;
        Assert.Equal("Công bố danh sách đề tài", history[0].Action);
        Assert.Equal("Trạng thái", history[0].Category);
    }

    [Fact]
    public async Task AfterPublishingOnlyDescriptionAndRequirementsOfTopicsWithoutAGroupChange()
    {
        var w = await OpenRound();
        var topic = await Submit(w);
        await Publish(w);

        var mine = (await Send(new ListMyTopicsQuery(w.Lecturer, w.RoundId))).Response.Data!;
        Assert.False(mine.Round.CanSubmit);
        Assert.Equal("content", mine.Items[0].CanEdit);
        Assert.False(mine.Items[0].CanDelete);

        var add = await Send(new CreateTopicCommand(w.Lecturer, Input(w.RoundId, "Đề tài muộn")));
        Assert.Equal(TopicResultStatus.Conflict, add.Status);
        Assert.Equal("Danh sách đề tài đã công bố nên không thêm đề tài mới.", add.Response.Message);

        var delete = await Send(new DeleteTopicCommand(w.Lecturer, topic.Id));
        Assert.Equal(TopicResultStatus.Conflict, delete.Status);

        foreach (var change in new Action<TopicInputDto>[] { i => i.Title = "Đổi tên", i => i.Field = "Mạng máy tính" })
        {
            var locked = await Send(new UpdateTopicCommand(w.Lecturer, topic.Id, Edit(topic, change)));
            Assert.Equal(TopicResultStatus.Conflict, locked.Status);
            Assert.Equal("Sau khi công bố chỉ sửa được mô tả và yêu cầu của đề tài.", locked.Response.Message);
        }

        var content = await Send(new UpdateTopicCommand(w.Lecturer, topic.Id, Edit(topic, i =>
        {
            i.Description = "Mô tả mới";
            i.Requirements = null;
        })));
        Assert.Equal(TopicResultStatus.Ok, content.Status);
        Assert.Equal("Mô tả mới", content.Response.Data!.Description);
        Assert.Null(content.Response.Data.Requirements);
    }

    [Fact]
    public async Task TopicsWithAGroupCannotBeEditedOrDeleted()
    {
        var w = await OpenRound();
        var topic = await Submit(w);
        await Publish(w);
        await SetStatus(topic.Id, TopicStatus.Registered);

        var edit = await Send(new UpdateTopicCommand(w.Lecturer, topic.Id, Edit(topic, i => i.Description = "Đổi")));
        Assert.Equal(TopicResultStatus.Conflict, edit.Status);
        Assert.Equal("Đề tài đã có nhóm nên không sửa được.", edit.Response.Message);
        var mine = (await Send(new ListMyTopicsQuery(w.Lecturer, w.RoundId))).Response.Data!;
        Assert.Equal("none", mine.Items[0].CanEdit);
    }

    [Fact]
    public async Task LoadAboveTheMaximumOnlyWarns()
    {
        var w = await OpenRound(loadMin: 1, loadMax: 2);
        await Submit(w, title: "Một");
        await Submit(w, title: "Hai");

        var third = await Send(new CreateTopicCommand(w.Lecturer, Input(w.RoundId, "Ba")));

        Assert.Equal(TopicResultStatus.Created, third.Status);
        Assert.Contains("vượt mức tối đa 2 đề tài", third.Response.Message);
        var mine = (await Send(new ListMyTopicsQuery(w.Lecturer, w.RoundId))).Response.Data!;
        Assert.Equal(new LecturerLoadDto { LecturerId = w.Lecturer, Count = 3, Min = 1, Max = 2, Level = "over" }, mine.Load, LoadComparer.Instance);
        var staff = (await Send(new ListRoundTopicsQuery(w.RoundId))).Response.Data!;
        Assert.Equal("below", staff.Loads.Single(l => l.LecturerId == w.OtherLecturer).Level);
    }

    [Fact]
    public async Task StudentsSeeTopicsOnlyAfterPublishingAndOnlyInTheirRound()
    {
        var w = await OpenRound();
        await Submit(w);

        var before = await Send(new ListPublishedTopicsQuery(w.Student, w.RoundId));
        Assert.Equal(TopicResultStatus.Conflict, before.Status);
        Assert.Equal("Giáo vụ chưa công bố danh sách đề tài của đợt.", before.Response.Message);

        await Publish(w);
        var after = (await Send(new ListPublishedTopicsQuery(w.Student, w.RoundId))).Response.Data!;
        var item = Assert.Single(after.Items);
        Assert.Equal("Chưa đăng ký", item.Status);
        Assert.Equal("none", item.CanEdit);

        Assert.Equal(TopicResultStatus.Forbidden, (await Send(new ListPublishedTopicsQuery(Guid.NewGuid(), w.RoundId))).Status);
        var detail = await Send(new GetTopicQuery(item.Id, w.Student, ViewerRole.Student));
        Assert.Equal(TopicResultStatus.Ok, detail.Status);
        Assert.Empty(detail.Response.Data!.History);
    }

    [Fact]
    public async Task WhenRegistrationClosesTopicsWithoutAGroupBecomeNoGroupAndTheRoundCanFinish()
    {
        var w = await OpenRound();
        await Submit(w);
        await Publish(w);

        _clock.Set(AfterRegistration);
        var list = (await Send(new ListRoundTopicsQuery(w.RoundId))).Response.Data!;
        Assert.Equal("Không có nhóm", list.Items[0].Status);

        var round = (await Send(new GetRoundQuery(w.RoundId, null))).Response.Data!;
        Assert.Equal(0, round.TopicSummary.PendingResultCount);
        Assert.Equal(1, round.TopicSummary.ByStatus["Không có nhóm"]);
        Assert.Equal(RoundResultStatus.Ok, (await Send(new FinishRoundCommand(w.RoundId))).Status);
    }

    [Fact]
    public async Task FinishingIsBlockedWhileTopicsAreUnsettled()
    {
        var w = await OpenRound();
        await Submit(w);
        await Publish(w);

        var finish = await Send(new FinishRoundCommand(w.RoundId));

        Assert.Equal(RoundResultStatus.Conflict, finish.Status);
        Assert.StartsWith("Còn 1 đề tài chưa công bố kết quả.", finish.Response.Message);
    }

    [Fact]
    public async Task AProposalCanBeEditedCancelledByAnyMemberAndResubmittedWithTheSameGroup()
    {
        var w = await OpenRound();
        await Submit(w);
        await Publish(w);
        var input = new ProposalInputDto
        {
            RoundId = w.RoundId,
            SupervisorId = w.Lecturer,
            Title = "Đề tài sinh viên đề xuất",
            Field = "Trí tuệ nhân tạo",
            Description = "Mô tả đề xuất",
            Requirements = "Biết Python",
            MemberCodes = [w.PartnerCode]
        };

        var created = await Send(new CreateProposalCommand(w.Student, input));

        Assert.Equal(TopicResultStatus.Created, created.Status);
        var first = created.Response.Data!;
        Assert.Equal("Chờ GV duyệt", first.Status);
        Assert.Equal("SV đề xuất", first.Source);
        Assert.Equal(2, first.Group.Count);
        var groupId = (await Send(new ListMyProposalsQuery(w.Student, w.RoundId))).Response.Data!.Group!.Id;

        var updated = await Send(new UpdateProposalCommand(w.Student, first.Id, new ProposalUpdateDto
        {
            SupervisorId = w.Lecturer,
            Title = "Đề tài đã sửa",
            Field = input.Field,
            Description = "Mô tả đã sửa",
            Requirements = input.Requirements
        }));
        Assert.Equal(TopicResultStatus.Ok, updated.Status);
        Assert.Equal("Đề tài đã sửa", updated.Response.Data!.Title);

        var wrongLecturer = await Send(new AcceptProposalCommand(w.OtherLecturer, first.Id));
        Assert.Equal(TopicResultStatus.Forbidden, wrongLecturer.Status);

        var cancelled = await Send(new CancelProposalCommand(w.Partner, first.Id));
        Assert.Equal(TopicResultStatus.Ok, cancelled.Status);
        Assert.Equal("Đã hủy", cancelled.Response.Data!.Status);
        Assert.Equal(w.Partner, cancelled.Response.Data.Group.Single(m => m.Representative == false).Id);
        Assert.Equal(TopicResultStatus.Conflict, (await Send(new CancelProposalCommand(w.Student, first.Id))).Status);

        var resubmitted = await Send(new CreateProposalCommand(w.Student, new ProposalInputDto
        {
            RoundId = input.RoundId,
            SupervisorId = input.SupervisorId,
            Title = input.Title,
            Field = input.Field,
            Description = input.Description,
            Requirements = input.Requirements,
            MemberCodes = []
        }));
        Assert.Equal(TopicResultStatus.Created, resubmitted.Status);
        Assert.Equal(groupId, (await Send(new ListMyProposalsQuery(w.Student, w.RoundId))).Response.Data!.Group!.Id);

        var history = (await Send(new ListMyProposalsQuery(w.Student, w.RoundId))).Response.Data!;
        Assert.Equal(2, history.Items.Count);
        var cancelledHistory = history.Items.Single(p => p.Id == first.Id);
        Assert.Equal("Đã hủy", cancelledHistory.Status);
        Assert.Contains(cancelledHistory.History, h => h.Action == "Hủy đề xuất" && h.Actor.Contains(w.PartnerCode));
    }

    [Fact]
    public async Task OnlyTheNamedSupervisorAcceptsOrRejectsAndRejectionKeepsItsReason()
    {
        var w = await OpenRound();
        await Submit(w);
        await Publish(w);
        var proposal = (await Send(new CreateProposalCommand(w.Student, new ProposalInputDto
        {
            RoundId = w.RoundId,
            SupervisorId = w.Lecturer,
            Title = "Đề tài cần duyệt",
            Field = "Kỹ thuật phần mềm",
            Description = "Mô tả đề xuất"
        }))).Response.Data!;

        Assert.Equal(TopicResultStatus.Forbidden, (await Send(new AcceptProposalCommand(w.OtherLecturer, proposal.Id))).Status);
        await Assert.ThrowsAsync<ValidationException>(() => Send(new RejectProposalCommand(w.Lecturer, proposal.Id, " ")));

        var rejected = await Send(new RejectProposalCommand(w.Lecturer, proposal.Id, "Trùng với đề tài đã có."));
        Assert.Equal(TopicResultStatus.Ok, rejected.Status);
        Assert.Equal("Bị từ chối", rejected.Response.Data!.Status);
        Assert.Equal(TopicResultStatus.Conflict, (await Send(new CancelProposalCommand(w.Student, proposal.Id))).Status);

        var detail = (await Send(new GetTopicQuery(proposal.Id, w.Student, ViewerRole.Student))).Response.Data!;
        var decision = Assert.Single(detail.History, h => h.Action == "Từ chối đề xuất");
        Assert.Contains("Trùng với đề tài đã có.", decision.Detail);
        Assert.StartsWith("Người GV", decision.Actor);
    }

    [Fact]
    public async Task ProposalSupervisorListContainsOnlyLecturersOfTheStudentsRound()
    {
        var w = await OpenRound();

        var list = await Send(new ListProposalSupervisorsQuery(w.Student, w.RoundId));

        Assert.Equal(TopicResultStatus.Ok, list.Status);
        Assert.Equal(new[] { w.Lecturer, w.OtherLecturer }.Order(), list.Response.Data!.Select(person => person.Id).Order());
        Assert.Equal(TopicResultStatus.Forbidden,
            (await Send(new ListProposalSupervisorsQuery(Guid.NewGuid(), w.RoundId))).Status);
    }

    [Fact]
    public async Task AProposalIsAcceptedExactlyOnceAndItsHistoryIsVisibleToAcademicAffairs()
    {
        var w = await OpenRound();
        await Submit(w);
        await Publish(w);
        var proposal = (await Send(new CreateProposalCommand(w.Student, new ProposalInputDto
        {
            RoundId = w.RoundId,
            SupervisorId = w.Lecturer,
            Title = "Đề tài được chấp nhận",
            Field = "Hệ thống thông tin",
            Description = "Mô tả đề xuất"
        }))).Response.Data!;

        _clock.Advance(TimeSpan.FromMinutes(1));
        var accepted = await Send(new AcceptProposalCommand(w.Lecturer, proposal.Id));
        Assert.Equal(TopicResultStatus.Ok, accepted.Status);
        Assert.Equal("Đã đăng ký", accepted.Response.Data!.Status);
        Assert.Equal(TopicResultStatus.Conflict, (await Send(new AcceptProposalCommand(w.Lecturer, proposal.Id))).Status);

        var detail = (await Send(new GetTopicQuery(proposal.Id, Guid.Empty, ViewerRole.AcademicAffairs))).Response.Data!;
        Assert.Equal(["Chấp nhận đề xuất", "Gửi đề xuất"], detail.History.Select(h => h.Action));
        Assert.StartsWith("Người GV", detail.History[0].Actor);
    }

    [Fact]
    public async Task ALecturerWithTopicsInTheRoundCannotBeRemovedFromIt()
    {
        var w = await OpenRound();
        await Submit(w);

        var removed = await Send(new RemoveParticipantCommand(w.RoundId, "lecturers", w.Lecturer));
        var other = await Send(new RemoveParticipantCommand(w.RoundId, "lecturers", w.OtherLecturer));

        Assert.Equal(RoundResultStatus.Conflict, removed.Status);
        Assert.Equal(RoundResultStatus.Ok, other.Status);
    }

    private async Task SetStatus(Guid topicId, TopicStatus status)
    {
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var topic = await db.ThesisTopics.SingleAsync(t => t.Id == topicId);
        topic.Status = status;
        await db.SaveChangesAsync();
    }

    private sealed class LoadComparer : IEqualityComparer<LecturerLoadDto>
    {
        public static readonly LoadComparer Instance = new();
        public bool Equals(LecturerLoadDto? a, LecturerLoadDto? b) =>
            a is not null && b is not null && a.LecturerId == b.LecturerId && a.Count == b.Count && a.Min == b.Min && a.Max == b.Max && a.Level == b.Level;
        public int GetHashCode(LecturerLoadDto obj) => obj.LecturerId.GetHashCode();
    }
}
