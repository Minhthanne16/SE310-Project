using Backend.Application;
using Backend.Application.Common.Storage;
using Backend.Application.Reviewers;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Submissions;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

// P05-S02: phân công Giảng viên phản biện theo PDR-021/022/023 và PDR-062, chạy handler thật trên
// repository EF Core thật (SQLite trong bộ nhớ).
public sealed class ReviewerAssignmentWorkflowTests : IDisposable
{
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DuringOutline = new(2026, 9, 16, 3, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);

    public ReviewerAssignmentWorkflowTests()
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
        services.AddScoped<ISubmissionRepository, SubmissionRepository>();
        services.AddScoped<IReviewerRepository, ReviewerRepository>();
        services.AddSingleton<IDocumentStorage>(new InMemoryAvatarStorage());
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
        _clock.Advance(TimeSpan.FromMinutes(1));
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private async Task Db(Func<ApplicationDbContext, Task> action)
    {
        using var scope = _provider.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private sealed record Person(Guid Id, string Code);

    // Đợt đang diễn ra có Giáo vụ, ba GV (A hướng dẫn, B, C) và một GV ngoài đợt; chưa có đề tài.
    private sealed class World
    {
        public Guid RoundId;
        public Person Staff = null!, A = null!, B = null!, C = null!, Outside = null!;
        public int StudentCounter;
        public string Suffix = string.Empty;
    }

    private async Task<Person> Seed(UserRole role, string code)
    {
        Guid id = default;
        await Db(async db => id = await RoundWorkflowTests.SeedUser(db, role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM"));
        return new Person(id, code);
    }

    private async Task<World> NewWorld(int loadMax = 0)
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var w = new World
        {
            Suffix = s,
            Staff = await Seed(UserRole.AcademicAffairs, $"GVU{s}"),
            A = await Seed(UserRole.Lecturer, $"GV{s}A"),
            B = await Seed(UserRole.Lecturer, $"GV{s}B"),
            C = await Seed(UserRole.Lecturer, $"GV{s}C"),
            Outside = await Seed(UserRole.Lecturer, $"GV{s}X")
        };
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        w.RoundId = round.Id;
        await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [w.A.Code, w.B.Code, w.C.Code]));
        return w;
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
                AllowLate = ThesisRound.HasLateToggle(key) ? key is not (MilestoneKey.Outline or MilestoneKey.Finalize) : null,
                LateEndDate = key is MilestoneKey.Midterm or MilestoneKey.Final ? start.AddDays(i * 7 + 6).ToString("yyyy-MM-dd") : null
            }).ToList()
        };
    }

    // Mở đợt (một lần) khi đã có đủ người tham gia; thêm sinh viên cho từng đề tài có nhóm.
    private async Task OpenRound(World w, int students)
    {
        var codes = new List<string>();
        for (var i = 0; i < students; i++) codes.Add((await Seed(UserRole.Student, $"SV{w.Suffix}{w.StudentCounter++}")).Code);
        await Send(new AddParticipantsCommand(w.RoundId, "students", codes));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(w.RoundId))).Status);
    }

    private sealed record TopicSpec(Person Supervisor, string Field, bool Group, bool Approved);

    // Tạo đề tài trước công bố rồi công bố, ghi danh nhóm cho đề tài có nhóm (sinh viên lấy từ danh sách đợt theo thứ tự).
    private async Task<List<Guid>> CreateTopics(World w, params TopicSpec[] specs)
    {
        var ids = new List<Guid>();
        foreach (var spec in specs)
        {
            var created = await Send(new CreateTopicCommand(spec.Supervisor.Id, new TopicInputDto
            {
                RoundId = w.RoundId, Title = $"Đề tài {ids.Count + 1}", Field = spec.Field, Description = "Mô tả"
            }));
            Assert.Equal(TopicResultStatus.Created, created.Status);
            ids.Add(created.Response.Data!.Id);
        }
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(w.RoundId))).Status);
        var students = new List<string>();
        await Db(async db => students = await db.RoundParticipants.Where(p => p.RoundId == w.RoundId && p.Kind == ParticipantKind.Student)
            .Select(p => p.User!.UserCode).OrderBy(c => c).ToListAsync());
        var cursor = 0;
        for (var i = 0; i < specs.Length; i++)
        {
            if (!specs[i].Group) continue;
            var rep = students[cursor++];
            var partner = students[cursor++];
            var repId = Guid.Empty;
            await Db(async db => repId = (await db.Users.SingleAsync(u => u.UserCode == rep)).Id);
            Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(repId, ids[i], [partner]))).Status);
        }
        _clock.Set(DuringOutline);
        for (var i = 0; i < specs.Length; i++)
            if (specs[i].Approved)
                await Db(async db =>
                {
                    var topic = await db.ThesisTopics.SingleAsync(t => t.Id == ids[i]);
                    topic.OutlineApprovedAt = _clock.GetUtcNow().UtcDateTime;
                    topic.OutlineApprovedById = specs[i].Supervisor.Id;
                    await db.SaveChangesAsync();
                });
        return ids;
    }

    private Task<TopicResult<AssignReviewerResultDto>> Assign(World w, Guid topicId, Person reviewer, Person? expected = null) =>
        Send(new AssignReviewerCommand(w.Staff.Id, topicId, new AssignReviewerInputDto { ReviewerId = reviewer.Id, ExpectedReviewerId = expected?.Id }));

    private async Task<ReviewerAssignmentsDto> List(World w) =>
        (await Send(new ListReviewerAssignmentsQuery(w.RoundId))).Response.Data!;

    private async Task<ThesisTopic> Topic(Guid id)
    {
        ThesisTopic? topic = null;
        await Db(async db => topic = await db.ThesisTopics.AsNoTracking().SingleAsync(t => t.Id == id));
        return topic!;
    }

    // Hai đề tài đủ điều kiện (nhóm, đề cương đã duyệt) của GV A.
    private async Task<(World W, List<Guid> Topics)> Eligible(int loadMax = 0)
    {
        var w = await NewWorld(loadMax);
        await OpenRound(w, 8);
        if (loadMax > 0) await Db(async db => { (await db.ThesisRounds.SingleAsync(r => r.Id == w.RoundId)).LecturerLoadMax = loadMax; await db.SaveChangesAsync(); });
        var topics = await CreateTopics(w,
            new TopicSpec(w.A, "CNPM", true, true), new TopicSpec(w.A, "CNPM", true, true), new TopicSpec(w.B, "AI", true, true));
        return (w, topics);
    }

    [Fact]
    public async Task OutlineMustBeApprovedBeforeAssigning()
    {
        var w = await NewWorld();
        await OpenRound(w, 4);
        var topics = await CreateTopics(w, new TopicSpec(w.A, "CNPM", true, false), new TopicSpec(w.A, "CNPM", true, true));

        var blocked = await Assign(w, topics[0], w.B);
        Assert.Equal(TopicResultStatus.Conflict, blocked.Status);
        Assert.Equal("Chưa duyệt đề cương", blocked.Response.Message);
        var rows = (await List(w)).Topics;
        Assert.False(rows[0].Eligible);
        Assert.Equal("Chưa duyệt đề cương", rows[0].BlockedReason);
        Assert.True(rows[1].Eligible);
        Assert.Null((await Topic(topics[0])).ReviewerId);
    }

    [Fact]
    public async Task ApprovedOutlineIsEnoughWithoutMidtermOrFinalReport()
    {
        var (w, topics) = await Eligible();

        var result = await Assign(w, topics[0], w.B);

        Assert.Equal(TopicResultStatus.Ok, result.Status);
        var row = result.Response.Data!.Row;
        Assert.Equal(w.B.Code, row.Reviewer!.Code);
        Assert.False(row.HasMidterm);
        Assert.False(row.HasFinal);
        Assert.Null(result.Response.Data.Warning);
        var stored = await Topic(topics[0]);
        Assert.Equal(w.B.Id, stored.ReviewerId);
        Assert.Equal(w.Staff.Id, stored.ReviewerAssignedById);
        Assert.NotNull(stored.ReviewerAssignedAt);
    }

    [Fact]
    public async Task SupervisorCannotReviewOwnTopicNorLecturerOutsideTheRound()
    {
        var (w, topics) = await Eligible();

        var own = await Assign(w, topics[0], w.A);
        var outside = await Assign(w, topics[0], w.Outside);

        Assert.Equal(TopicResultStatus.Conflict, own.Status);
        Assert.Equal(ReviewerRules.SupervisorMessage, own.Response.Message);
        Assert.Equal(TopicResultStatus.Conflict, outside.Status);
        Assert.Equal(ReviewerRules.NotRoundLecturerMessage, outside.Response.Message);
        Assert.Null((await Topic(topics[0])).ReviewerId);
        // Ràng buộc ở database chặn cả khi bỏ qua tầng ứng dụng.
        await Assert.ThrowsAnyAsync<Exception>(() => Db(async db =>
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE ThesisTopics SET ReviewerId = SupervisorId WHERE Id = {0}", topics[0]);
        }));
    }

    [Fact]
    public async Task RepeatedAssignmentIsIdempotentAndStaleExpectationIsRejected()
    {
        var (w, topics) = await Eligible();
        Assert.Equal(TopicResultStatus.Ok, (await Assign(w, topics[0], w.B)).Status);

        var again = await Assign(w, topics[0], w.B);
        var stale = await Assign(w, topics[0], w.C);
        var wrong = await Assign(w, topics[0], w.C, expected: w.C);
        var right = await Assign(w, topics[0], w.C, expected: w.B);

        Assert.Equal(TopicResultStatus.Ok, again.Status);
        Assert.Equal(TopicResultStatus.Conflict, stale.Status);
        Assert.Equal(ReviewerRules.ChangedMessage, stale.Response.Message);
        Assert.Equal(TopicResultStatus.Conflict, wrong.Status);
        Assert.Equal(TopicResultStatus.Ok, right.Status);
        await Db(async db =>
        {
            // Một lần gán và một lần đổi; lần lặp không ghi thêm.
            Assert.Equal(2, await db.TopicHistoryEntries.CountAsync(h => h.TopicId == topics[0] && h.Category == "Phân công"));
        });
    }

    [Fact]
    public async Task ChangeBeforeFirstScoreWritesHistoryAndNotifiesOldAndNewReviewerOnly()
    {
        var (w, topics) = await Eligible();
        await Assign(w, topics[0], w.B);

        var changed = await Assign(w, topics[0], w.C, expected: w.B);

        Assert.Equal(TopicResultStatus.Ok, changed.Status);
        Assert.Equal("Đã đổi phản biện.", changed.Response.Message);
        await Db(async db =>
        {
            var history = await db.TopicHistoryEntries.Where(h => h.TopicId == topics[0] && h.Category == "Phân công")
                .OrderBy(h => h.CreatedAt).ToListAsync();
            Assert.Equal(["Phân công phản biện", "Đổi phản biện"], history.Select(h => h.Action));
            Assert.Equal($"Người {w.B.Code} ({w.B.Code}) → Người {w.C.Code} ({w.C.Code})", history[1].Detail);
            Assert.Equal(w.Staff.Id, history[1].ActorUserId);
            var notes = await db.Notifications.OrderBy(n => n.CreatedAt).ToListAsync();
            Assert.Equal(w.B.Id, notes.First(n => n.Text.StartsWith("Bạn được phân công")).RecipientUserId);
            var removed = notes.Single(n => n.Text == "Bạn không còn phản biện DT-001");
            Assert.Equal(w.B.Id, removed.RecipientUserId);
            Assert.Equal("/gv/phan-bien", removed.Href);
            var added = notes.Last(n => n.Text.StartsWith("Bạn được phân công"));
            Assert.Equal(w.C.Id, added.RecipientUserId);
            Assert.Equal("assign", added.Kind);
            Assert.Equal($"/de-tai/{topics[0]}", added.Href);
            Assert.DoesNotContain(notes, n => n.RecipientUserId == w.A.Id && n.Text.Contains("phản biện"));
        });
    }

    [Fact]
    public async Task ChangeAfterFirstScoreIsLockedForSingleAndBatchAssignments()
    {
        var (w, topics) = await Eligible();
        await Assign(w, topics[0], w.B);
        await Db(async db =>
        {
            (await db.ThesisTopics.SingleAsync(t => t.Id == topics[0])).ReviewerFirstScoredAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        });

        var single = await Assign(w, topics[0], w.C, expected: w.B);
        var batch = (await Send(new AssignReviewersBatchCommand(w.Staff.Id, new ReviewerBatchInputDto
        {
            RoundId = w.RoundId,
            Items = [new() { TopicId = topics[0], ReviewerId = w.C.Id, ExpectedReviewerId = w.B.Id }]
        }))).Response.Data!;

        Assert.Equal(TopicResultStatus.Conflict, single.Status);
        Assert.Equal(ReviewerRules.LockedMessage, single.Response.Message);
        Assert.Equal(1, batch.Failed);
        Assert.Equal(ReviewerRules.LockedMessage, batch.Results[0].Message);
        Assert.Equal(w.B.Id, (await Topic(topics[0])).ReviewerId);
        var row = (await List(w)).Topics.Single(t => t.TopicId == topics[0]);
        Assert.True(row.Locked);
        Assert.Equal(ReviewerRules.LockedMessage, row.LockReason);
    }

    [Fact]
    public async Task BatchReportsEachRowAndKeepsValidRows()
    {
        var w = await NewWorld();
        await OpenRound(w, 6);
        var topics = await CreateTopics(w,
            new TopicSpec(w.A, "CNPM", true, true), new TopicSpec(w.A, "CNPM", true, false), new TopicSpec(w.B, "AI", true, true));

        var result = (await Send(new AssignReviewersBatchCommand(w.Staff.Id, new ReviewerBatchInputDto
        {
            RoundId = w.RoundId,
            Items =
            [
                new() { TopicId = topics[0], ReviewerId = w.B.Id },
                new() { TopicId = topics[1], ReviewerId = w.B.Id },
                new() { TopicId = topics[2], ReviewerId = w.B.Id },
                new() { TopicId = topics[0], ReviewerId = w.C.Id },
                new() { TopicId = Guid.NewGuid(), ReviewerId = w.C.Id }
            ]
        }))).Response.Data!;

        Assert.Equal(1, result.Succeeded);
        Assert.Equal(4, result.Failed);
        Assert.Equal([true, false, false, false, false], result.Results.Select(r => r.Ok));
        Assert.Equal("Chưa duyệt đề cương", result.Results[1].Message);
        Assert.Equal(ReviewerRules.SupervisorMessage, result.Results[2].Message);
        Assert.Equal(ReviewerRules.DuplicateInBatchMessage, result.Results[3].Message);
        Assert.Equal(ReviewerRules.TopicNotInRoundMessage, result.Results[4].Message);
        Assert.Equal(w.B.Id, (await Topic(topics[0])).ReviewerId);
        Assert.Null((await Topic(topics[1])).ReviewerId);
    }

    [Fact]
    public async Task BatchValidationRejectsEmptyAndOversizedLots()
    {
        var w = await NewWorld();
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            Send(new AssignReviewersBatchCommand(w.Staff.Id, new ReviewerBatchInputDto { RoundId = w.RoundId, Items = [] })));
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            Send(new AssignReviewersBatchCommand(w.Staff.Id, new ReviewerBatchInputDto
            {
                RoundId = w.RoundId,
                Items = Enumerable.Range(0, 201).Select(_ => new ReviewerBatchItemDto { TopicId = Guid.NewGuid(), ReviewerId = w.B.Id }).ToList()
            })));
    }

    [Fact]
    public async Task OverloadOnlyWarns()
    {
        var (w, topics) = await Eligible(loadMax: 1);
        Assert.Null((await Assign(w, topics[0], w.B)).Response.Data!.Warning);

        var over = await Assign(w, topics[1], w.B);

        Assert.Equal(TopicResultStatus.Ok, over.Status);
        Assert.Contains("vượt mức tối đa 1", over.Response.Data!.Warning);
        var load = (await List(w)).Lecturers.Single(l => l.Id == w.B.Id);
        Assert.Equal(2, load.ReviewCount);
        Assert.Equal("over", load.Level);
    }

    [Fact]
    public async Task SuggestionsRankSameFieldThenLessLoadAndNeverWrite()
    {
        var (w, topics) = await Eligible(loadMax: 2);
        // B hướng dẫn đề tài AI; C chưa có đề tài. Đề tài 0 và 1 (CNPM, GVHD A): chưa ai cùng lĩnh vực CNPM ngoài A.
        var before = await Snapshot();

        var s = (await Send(new SuggestReviewersQuery(w.RoundId))).Response.Data!;

        Assert.Equal(3, s.Count);
        // C có 0 đề tài hướng dẫn, B có 1: chọn C trước (ít phản biện bằng nhau, ít hướng dẫn hơn).
        Assert.Equal(w.C.Id, s.Single(x => x.TopicId == topics[0]).LecturerId);
        // Lượt gợi ý tính vào số phản biện: đề tài thứ hai chuyển sang B (C đã có 1, B có 0).
        Assert.Equal(w.B.Id, s.Single(x => x.TopicId == topics[1]).LecturerId);
        // Đề tài AI của B: A và C đều không cùng lĩnh vực; C có 1, A có 0 phản biện, A hướng dẫn 2 đề tài.
        Assert.Equal(w.A.Id, s.Single(x => x.TopicId == topics[2]).LecturerId);
        Assert.Equal(before, await Snapshot());
    }

    [Fact]
    public async Task SuggestionsPreferSameFieldAndSkipFullLecturersAndSupervisor()
    {
        var w = await NewWorld();
        await OpenRound(w, 8);
        await Db(async db => { (await db.ThesisRounds.SingleAsync(r => r.Id == w.RoundId)).LecturerLoadMax = 1; await db.SaveChangesAsync(); });
        var topics = await CreateTopics(w,
            new TopicSpec(w.A, "AI", true, true), new TopicSpec(w.B, " ai ", true, true), new TopicSpec(w.C, "Mạng", true, true), new TopicSpec(w.A, "Mạng", true, true));
        // C đã đạt mức tối đa 1 (phản biện đề tài 0).
        Assert.Equal(TopicResultStatus.Ok, (await Assign(w, topics[0], w.C)).Status);

        var s = (await Send(new SuggestReviewersQuery(w.RoundId))).Response.Data!;

        // Chỉ đề tài chưa có GVPB: 1, 2, 3.
        Assert.Equal([topics[1], topics[2], topics[3]], s.Select(x => x.TopicId));
        // Đề tài 1 (AI, GVHD B): A cùng lĩnh vực AI; C đã đủ mức.
        Assert.Equal(w.A.Id, s[0].LecturerId);
        Assert.Contains("Cùng lĩnh vực", s[0].Reason);
        // Đề tài 2 (Mạng, GVHD C): A hướng dẫn Mạng nhưng đã nhận 1 gợi ý (mức tối đa 1); B không cùng lĩnh vực, còn chỗ.
        Assert.Equal(w.B.Id, s[1].LecturerId);
        // Đề tài 3 (Mạng, GVHD A): A là GVHD, B đã nhận 1 gợi ý (đủ), C đã đủ mức => không ai.
        Assert.Null(s[2].LecturerId);
        Assert.False(string.IsNullOrWhiteSpace(s[2].Reason));
    }

    [Fact]
    public async Task SuggestionsDoNotCapWhenMaxIsNotSet()
    {
        var (w, topics) = await Eligible(loadMax: 0);

        var s = (await Send(new SuggestReviewersQuery(w.RoundId))).Response.Data!;

        Assert.All(s, x => Assert.NotNull(x.LecturerId));
        Assert.DoesNotContain(s, x => x.TopicId == topics[0] && x.LecturerId == w.A.Id);
    }

    [Fact]
    public void ScoreBlockerNeedsAssignmentAndFinalReportOnly()
    {
        var me = Guid.NewGuid();
        var topic = new ThesisTopic { ReviewerId = me };
        Assert.Null(ReviewerRules.ScoreBlocker(topic, me, hasFinal: true));
        Assert.Equal(ReviewerRules.NoFinalMessage, ReviewerRules.ScoreBlocker(topic, me, hasFinal: false));
        Assert.Equal(ReviewerRules.NotReviewerMessage, ReviewerRules.ScoreBlocker(topic, Guid.NewGuid(), hasFinal: true));
        Assert.Equal(ReviewerRules.NotReviewerMessage, ReviewerRules.ScoreBlocker(new ThesisTopic(), me, hasFinal: true));
    }

    [Fact]
    public async Task OnlyCurrentReviewerCanReadAndOnlyReadTheTopic()
    {
        var (w, topics) = await Eligible();
        await Assign(w, topics[0], w.B);

        Assert.Equal(TopicResultStatus.Ok, (await Send(new GetTopicQuery(topics[0], w.B.Id, ViewerRole.Lecturer))).Status);
        var detail = (await Send(new GetTopicQuery(topics[0], w.B.Id, ViewerRole.Lecturer))).Response.Data!;
        Assert.Equal(w.B.Code, detail.Reviewer!.Code);
        Assert.Equal("none", detail.CanEdit);
        Assert.False(detail.CanDelete);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetTopicQuery(topics[0], w.C.Id, ViewerRole.Lecturer))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetTopicQuery(topics[1], w.B.Id, ViewerRole.Lecturer))).Status);

        var outline = (await Send(new GetOutlineQuery(topics[0], w.B.Id, ViewerRole.Lecturer))).Response.Data!;
        Assert.Equal("reviewer", outline.ViewerRole);
        Assert.False(outline.CanReview);
        Assert.False(outline.CanApprove);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new CommentOutlineCommand(w.B.Id, topics[0], Guid.NewGuid(), "x"))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new ApproveOutlineCommand(w.B.Id, topics[0], Guid.NewGuid()))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetOutlineQuery(topics[0], w.C.Id, ViewerRole.Lecturer))).Status);

        // GVPB cũ mất quyền xem sau khi bị đổi.
        await Assign(w, topics[0], w.C, expected: w.B);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetTopicQuery(topics[0], w.B.Id, ViewerRole.Lecturer))).Status);
        Assert.Equal(TopicResultStatus.Ok, (await Send(new GetTopicQuery(topics[0], w.C.Id, ViewerRole.Lecturer))).Status);
    }

    [Fact]
    public async Task MineListsAssignedTopicsAndOpensScoringAfterFinalReport()
    {
        var (w, topics) = await Eligible();
        await Assign(w, topics[0], w.B);

        var before = (await Send(new ListMyReviewTopicsQuery(w.B.Id, null))).Response.Data!;
        Assert.Equal(w.RoundId, before.RoundId);
        var item = Assert.Single(before.Items);
        Assert.False(item.CanScore);
        Assert.Equal(ReviewerRules.NoFinalMessage, item.ScoreBlockedReason);
        Assert.False(item.Scored);
        Assert.Equal(2, item.Group.Count);

        await Db(async db =>
        {
            db.TopicSubmissions.Add(new TopicSubmission
            {
                TopicId = topics[0], Kind = SubmissionKind.Final, VersionNo = 1, ObjectKey = "k", FileName = "cuoi-ky.pdf",
                SizeBytes = 10, SubmittedById = w.A.Id, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        });
        var after = (await Send(new ListMyReviewTopicsQuery(w.B.Id, null))).Response.Data!;
        Assert.True(after.Items[0].CanScore);
        Assert.Null(after.Items[0].ScoreBlockedReason);
        Assert.Empty((await Send(new ListMyReviewTopicsQuery(w.C.Id, null))).Response.Data!.Items);
    }

    [Fact]
    public async Task ReviewerCannotBeRemovedFromTheRound()
    {
        var (w, topics) = await Eligible();
        // C chưa hướng dẫn đề tài nào; chỉ việc đang phản biện chặn gỡ (PDR-062).
        await Assign(w, topics[0], w.C);

        var blocked = await Send(new RemoveParticipantCommand(w.RoundId, "lecturers", w.C.Id));
        await Assign(w, topics[0], w.B, expected: w.C);
        var free = await Send(new RemoveParticipantCommand(w.RoundId, "lecturers", w.C.Id));

        Assert.Equal(RoundResultStatus.Conflict, blocked.Status);
        Assert.Contains("đang phản biện", blocked.Response.Message);
        Assert.Equal(RoundResultStatus.Ok, free.Status);
    }

    [Fact]
    public async Task EndedRoundAndTopicsWithoutGroupCannotBeAssigned()
    {
        var w = await NewWorld();
        await OpenRound(w, 2);
        var topics = await CreateTopics(w, new TopicSpec(w.A, "CNPM", true, true), new TopicSpec(w.A, "CNPM", false, false));

        var noGroup = await Assign(w, topics[1], w.B);
        Assert.Equal(ReviewerRules.NoGroupMessage, noGroup.Response.Message);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new AssignReviewerCommand(w.Staff.Id, Guid.NewGuid(),
            new AssignReviewerInputDto { ReviewerId = w.B.Id }))).Status);
        await Db(async db =>
        {
            (await db.ThesisRounds.SingleAsync(r => r.Id == w.RoundId)).Status = RoundStatus.Finished;
            await db.SaveChangesAsync();
        });
        var finished = await Assign(w, topics[0], w.B);
        Assert.Equal(ReviewerRules.RoundNotRunningMessage, finished.Response.Message);
    }

    private async Task<string> Snapshot()
    {
        var text = string.Empty;
        await Db(async db =>
        {
            var topics = await db.ThesisTopics.AsNoTracking().OrderBy(t => t.Number).Select(t => $"{t.Id}:{t.ReviewerId}").ToListAsync();
            text = string.Join(",", topics) + "|" + await db.TopicHistoryEntries.CountAsync() + "|" + await db.Notifications.CountAsync();
        });
        return text;
    }
}
