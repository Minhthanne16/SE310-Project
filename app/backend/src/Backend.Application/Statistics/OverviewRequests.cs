using Backend.Application.Common;
using Backend.Application.Councils;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;

namespace Backend.Application.Statistics;

public sealed record GetOverviewStatisticsQuery : IRequest<TopicResult<OverviewStatisticsDto>>;

public static class AttentionAlertKinds
{
    public const string LecturerBelowMin = "LecturerBelowMin";
    public const string LecturerAboveMax = "LecturerAboveMax";
    public const string StudentsWithoutGroup = "StudentsWithoutGroup";
    public const string TopicsWithoutReviewer = "TopicsWithoutReviewer";
    public const string TopicsWithoutCouncil = "TopicsWithoutCouncil";
    public const string CouncilConflicts = "CouncilConflicts";
    public const string MilestoneMissing = "MilestoneMissing";
    public const string LateSubmissions = "LateSubmissions";
    // TODO sau B1: ReservationExpiring
    // TODO sau C1: ScoreDeviation
}

public sealed class RoundOverviewDto
{
    public Guid RoundId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? CurrentMilestoneKey { get; set; }
    public int TopicCount { get; set; }
    public int StudentsWithGroup { get; set; }
    public int StudentCount { get; set; }
    public int TopicsWithReviewer { get; set; }
    public int? TopicsScored { get; set; } // null khi chưa có hệ thống chấm (Phase 07)
    public int? TopicsWithDeviation { get; set; } // null khi chưa có hệ thống chấm (Phase 07)
}

public sealed class AttentionAlertDto
{
    public string Kind { get; set; } = string.Empty;
    public Guid RoundId { get; set; }
    public string RoundName { get; set; } = string.Empty;
    public int Count { get; set; }
    public string Target { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public sealed class OverviewStatisticsDto
{
    public List<RoundOverviewDto> Rounds { get; set; } = [];
    public List<AttentionAlertDto> Alerts { get; set; } = [];
}

public sealed class GetOverviewStatisticsHandler(
    IRoundRepository rounds,
    ISender sender,
    TimeProvider clock)
    : IRequestHandler<GetOverviewStatisticsQuery, TopicResult<OverviewStatisticsDto>>
{
    public const int UpcomingThresholdDays = 7; // OQ-033(d)

    public async Task<TopicResult<OverviewStatisticsDto>> Handle(GetOverviewStatisticsQuery request, CancellationToken cancellationToken)
    {
        var today = RoundRules.TodayVietnam(clock);
        var allRounds = await rounds.ListAsync(status: null, program: null, normalizedSearch: null, cancellationToken);

        var roundOverviews = new List<RoundOverviewDto>();
        var alerts = new List<AttentionAlertDto>();

        foreach (var round in allRounds)
        {
            // Mốc hiện tại
            var currentMilestone = round.Milestones
                .FirstOrDefault(m => m.StartDate is { } s && m.EndDate is { } e && today >= s && today <= e);
            var currentMilestoneKey = currentMilestone is not null ? RoundRules.KeyName(currentMilestone.Key) : null;

            // Người tham gia & đề tài
            var studentCount = round.Participants.Count(p => p.Kind == ParticipantKind.Student);
            var studentIds = round.Participants.Where(p => p.Kind == ParticipantKind.Student).Select(p => p.UserId).ToHashSet();

            var roundTopicsResult = await sender.Send(new ListRoundTopicsQuery(round.Id), cancellationToken);
            var topics = roundTopicsResult.Status == TopicResultStatus.Ok && roundTopicsResult.Response.Data is not null
                ? roundTopicsResult.Response.Data.Items
                : [];
            var loads = roundTopicsResult.Status == TopicResultStatus.Ok && roundTopicsResult.Response.Data is not null
                ? roundTopicsResult.Response.Data.Loads
                : [];

            var studentsWithGroup = topics.SelectMany(t => t.Group).Select(g => g.Id).Where(id => studentIds.Contains(id)).Distinct().Count();
            var topicsWithReviewer = topics.Count(t => t.Reviewer != null);

            var statusName = round.Status switch
            {
                RoundStatus.Draft => "Nháp",
                RoundStatus.Running => "Đang diễn ra",
                _ => "Đã kết thúc"
            };

            roundOverviews.Add(new RoundOverviewDto
            {
                RoundId = round.Id,
                Name = round.Name,
                Status = statusName,
                CurrentMilestoneKey = currentMilestoneKey,
                TopicCount = topics.Count,
                StudentsWithGroup = studentsWithGroup,
                StudentCount = studentCount,
                TopicsWithReviewer = topicsWithReviewer,
                TopicsScored = null,
                TopicsWithDeviation = null
            });

            // Chỉ tính cảnh báo cho đợt đang diễn ra
            if (round.Status == RoundStatus.Running)
            {
                // a) LecturerBelowMin & LecturerAboveMax (khi đã qua mốc Gửi đề tài)
                var topicSubMilestone = round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.TopicSubmission);
                if (topicSubMilestone?.EndDate is { } endSub && today > endSub)
                {
                    var belowCount = loads.Count(l => l.Level == "below");
                    if (belowCount > 0)
                    {
                        alerts.Add(new AttentionAlertDto
                        {
                            Kind = AttentionAlertKinds.LecturerBelowMin,
                            RoundId = round.Id,
                            RoundName = round.Name,
                            Count = belowCount,
                            Target = $"/giao-vu/dot/{round.Id}?tab=giang-vien",
                            Message = $"{belowCount} giảng viên chưa đủ số đề tài tối thiểu"
                        });
                    }

                    var aboveCount = loads.Count(l => l.Level == "over");
                    if (aboveCount > 0)
                    {
                        alerts.Add(new AttentionAlertDto
                        {
                            Kind = AttentionAlertKinds.LecturerAboveMax,
                            RoundId = round.Id,
                            RoundName = round.Name,
                            Count = aboveCount,
                            Target = $"/giao-vu/dot/{round.Id}?tab=giang-vien",
                            Message = $"{aboveCount} giảng viên vượt số đề tài tối đa"
                        });
                    }
                }

                // b) StudentsWithoutGroup (khi đã qua mốc Đăng ký đề tài)
                var regMilestone = round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.TopicRegistration);
                if (regMilestone?.EndDate is { } endReg && today > endReg)
                {
                    var withoutGroup = Math.Max(0, studentCount - studentsWithGroup);
                    if (withoutGroup > 0)
                    {
                        alerts.Add(new AttentionAlertDto
                        {
                            Kind = AttentionAlertKinds.StudentsWithoutGroup,
                            RoundId = round.Id,
                            RoundName = round.Name,
                            Count = withoutGroup,
                            Target = $"/giao-vu/dot/{round.Id}?tab=sinh-vien",
                            Message = $"{withoutGroup} sinh viên chưa có nhóm"
                        });
                    }
                }

                // c) TopicsWithoutReviewer (khi mốc Lịch PB sắp tới trong 7 ngày hoặc đang chạy)
                var revMilestone = round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.ReviewSchedule);
                if (revMilestone?.StartDate is { } revStart && (revStart.DayNumber - today.DayNumber) <= UpcomingThresholdDays)
                {
                    var unassigned = topics.Count(t => t.Reviewer == null && t.OutlineApprovedAt != null && t.Group.Count > 0
                        && t.Status != "Đã hoàn tất" && t.Status != "Không đủ điều kiện" && t.Status != "Không có nhóm");
                    if (unassigned > 0)
                    {
                        alerts.Add(new AttentionAlertDto
                        {
                            Kind = AttentionAlertKinds.TopicsWithoutReviewer,
                            RoundId = round.Id,
                            RoundName = round.Name,
                            Count = unassigned,
                            Target = $"/giao-vu/dot/{round.Id}?tab=danh-gia&muc=phan-bien",
                            Message = $"{unassigned} đề tài chưa có phản biện"
                        });
                    }
                }

                // d) TopicsWithoutCouncil & e) CouncilConflicts (dùng GetCouncilBoardQuery)
                var defMilestone = round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.DefenseSchedule);
                if (defMilestone?.StartDate is { } defStart && (defStart.DayNumber - today.DayNumber) <= UpcomingThresholdDays)
                {
                    var boardResult = await sender.Send(new GetCouncilBoardQuery(round.Id), cancellationToken);
                    if (boardResult.Status == TopicResultStatus.Ok && boardResult.Response.Data is not null)
                    {
                        var board = boardResult.Response.Data;
                        var unscheduled = board.Pool.Count(p => p.Eligible);
                        if (unscheduled > 0)
                        {
                            alerts.Add(new AttentionAlertDto
                            {
                                Kind = AttentionAlertKinds.TopicsWithoutCouncil,
                                RoundId = round.Id,
                                RoundName = round.Name,
                                Count = unscheduled,
                                Target = $"/giao-vu/dot/{round.Id}?tab=danh-gia&muc=hoi-dong",
                                Message = $"{unscheduled} đề tài chưa xếp hội đồng"
                            });
                        }

                        var conflictCouncils = board.Councils.Count(c => c.Conflicts.Count > 0);
                        if (conflictCouncils > 0)
                        {
                            alerts.Add(new AttentionAlertDto
                            {
                                Kind = AttentionAlertKinds.CouncilConflicts,
                                RoundId = round.Id,
                                RoundName = round.Name,
                                Count = conflictCouncils,
                                Target = $"/giao-vu/dot/{round.Id}?tab=danh-gia&muc=hoi-dong",
                                Message = $"{conflictCouncils} hội đồng có xung đột"
                            });
                        }
                    }
                }

                // f) MilestoneMissing (mốc kế tiếp chưa có ngày khi mốc trước còn <= 7 ngày hoặc đã kết thúc)
                var ordered = RoundRules.OrderedKeys
                    .Select(k => round.Milestones.FirstOrDefault(m => m.Key == k))
                    .ToList();
                for (var i = 0; i < ordered.Count - 1; i++)
                {
                    var curr = ordered[i];
                    var next = ordered[i + 1];
                    if (curr?.StartDate is { } cStart && curr.EndDate is { } cEnd)
                    {
                        if (today >= cStart && (cEnd.DayNumber - today.DayNumber) <= UpcomingThresholdDays)
                        {
                            if (next is null || next.StartDate is null || next.EndDate is null)
                            {
                                var nextKey = RoundRules.OrderedKeys[i + 1];
                                alerts.Add(new AttentionAlertDto
                                {
                                    Kind = AttentionAlertKinds.MilestoneMissing,
                                    RoundId = round.Id,
                                    RoundName = round.Name,
                                    Count = 1,
                                    Target = $"/giao-vu/dot/{round.Id}?tab=cau-hinh",
                                    Message = $"Mốc “{RoundRules.Name(nextKey)}” chưa được đặt ngày"
                                });
                            }
                        }
                    }
                }
            }
        }

        return TopicResult<OverviewStatisticsDto>.Ok(new OverviewStatisticsDto
        {
            Rounds = roundOverviews,
            Alerts = alerts
        });
    }
}
