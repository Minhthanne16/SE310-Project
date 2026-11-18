using System.Text;
using Backend.Application.Rounds;
using Backend.Application.Statistics;
using Backend.Application.Topics;
using Xunit;

namespace Backend.Tests;

public sealed class StatisticsExportTests
{
    [Theory]
    [InlineData("=1+1")]
    [InlineData("+SUM(A1:A2)")]
    [InlineData("-2+3")]
    [InlineData("@SUM(A1:A2)")]
    [InlineData("  =1+1")]
    [InlineData("\t=1+1")]
    [InlineData("\r=1+1")]
    [InlineData("\n=1+1")]
    public void CsvTreatsUntrustedCellsAsText(string dangerous)
    {
        var bytes = StatisticsExport.Csv(["Tên"], [[dangerous]]);
        Assert.Equal([0xEF, 0xBB, 0xBF], bytes.Take(3).ToArray());
        var csv = Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        Assert.Contains("'" + dangerous, csv);
        Assert.DoesNotContain("\n" + dangerous, csv);
    }

    [Fact]
    public void RegistrationRowsSupportTwoStudentsPerTopicAndUnassignedStudents()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var third = Guid.NewGuid();
        var round = new RoundStatisticsDto
        {
            Students =
            [
                new ParticipantDto { Id = third, Code = "03", Name = "Chưa có đề tài", Unit = "KTPM" },
                new ParticipantDto { Id = second, Code = "02", Name = "Thành viên", Unit = "KTPM" },
                new ParticipantDto { Id = first, Code = "01", Name = "Đại diện", Unit = "KTPM" }
            ],
            Items =
            [
                new TopicStatisticsRowDto
                {
                    Topic = new TopicDto
                    {
                        Code = "DT-01", Title = "Đề tài A", Status = "Đang thực hiện",
                        Supervisor = new TopicPersonDto { Name = "GVHD" },
                        Group = [new GroupMemberDto { Id = first }, new GroupMemberDto { Id = second }]
                    }
                },
                new TopicStatisticsRowDto
                {
                    Topic = new TopicDto { Code = "DT-02", Status = "Chưa đăng ký" }
                }
            ]
        };

        var rows = StatisticsExport.RegistrationRows(round).ToList();
        Assert.Equal(3, rows.Count);
        Assert.Equal(["01", "02", "03"], rows.Select(r => r[0]).ToArray());
        Assert.Equal(["DT-01", "DT-01", ""], rows.Select(r => r[3]).ToArray());
        Assert.Equal(["Đã đăng ký", "Đã đăng ký", "Chưa có đề tài"], rows.Select(r => r[6]).ToArray());
        Assert.Single(StatisticsExport.Filter(round, "Đang thực hiện", "đề tài a", null));
        Assert.Empty(StatisticsExport.Filter(round, "Đang thực hiện", "không có", null));
    }
}
