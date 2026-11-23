# PDR-070: Vai trò Giảng viên trong đợt; phản biện và hội đồng ở tab Đánh giá

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Bổ sung [PDR-062](PDR-062-phan-cong-phan-bien-mot-gvpb-moi-de-tai.md), [PDR-063](PDR-063-hoi-dong-va-lich-bao-ve.md) (nguồn chọn thành viên) và [PDR-030](PDR-030-khoa-go-nguoi-tham-gia-da-co-du-lieu.md).

## Bối cảnh

Danh sách giảng viên của đợt đang dùng chung cho hướng dẫn, phản biện và hội đồng, nên không xác định được ai là GVHD để đếm số đề tài tối thiểu/tối đa. Thực tế GVHD có thể đi phản biện và ngồi hội đồng, còn GVPB hoặc GV hội đồng có thể không hướng dẫn đề tài nào trong đợt.

## Quyết định

1. **Vai trò theo đợt:** mỗi Giảng viên trong danh sách của đợt có ba ô **Hướng dẫn**, **Phản biện**, **Hội đồng** (ít nhất một ô; thêm mới mặc định Hướng dẫn). Giáo vụ thêm được Giảng viên chỉ ngồi hội đồng hoặc chỉ phản biện.
2. **Hướng dẫn:** chỉ Giảng viên có vai trò này mới gửi đề tài, được chọn trong đề xuất, giữ chỗ Sinh viên và được đếm vào mức đề tài tối thiểu/tối đa (vẫn chỉ cảnh báo).
3. **Phản biện, Hội đồng:** phân công phản biện chỉ chọn Giảng viên có vai trò Phản biện; lập hội đồng chỉ chọn Giảng viên có vai trò Hội đồng.
4. **Không chấm đề tài mình hướng dẫn:** GVHD không được làm GVPB, Chủ tịch hay Thư ký của đề tài mình hướng dẫn. Ô chọn phản biện khóa GVHD; không xếp được đề tài vào hội đồng có Chủ tịch hoặc Thư ký là GVHD của đề tài, phải xếp sang hội đồng khác. GVPB vẫn được làm Chủ tịch/Thư ký chấm cùng đề tài (PDR-063).
5. **Phân vai hàng loạt bằng `.xlsx`:** cột Mã GV, Họ tên, Hướng dẫn, Phản biện, Hội đồng (đánh `x`). Hệ thống đối chiếu theo Mã GV với tài khoản Giảng viên có sẵn, hiện bước xem trước, dòng lỗi tô đỏ và bị bỏ qua; không tạo tài khoản mới. Giảng viên có trong file được thêm vào đợt nếu chưa có, vai trò ghi đè theo file; Giảng viên không có trong file giữ nguyên.
6. **Nơi thao tác:** phân công phản biện và lập hội đồng làm ngay trong **tab Đánh giá** của Chi tiết đợt; tab này gom mọi nghiệp vụ chấm điểm của đợt (cấu hình điểm PDR-065, mẫu phiếu, phản biện, hội đồng, kết quả). Hai mục sidebar Giáo vụ "Giảng viên phản biện" và "Hội đồng bảo vệ" giữ làm trang **chỉ xem** qua nhiều đợt (mặc định "Tất cả đợt đang diễn ra"); mỗi dòng có nút mở tab Đánh giá của đợt để sửa.

## Lựa chọn triển khai

- Bỏ một vai trò (bằng tay hoặc qua file) khi Giảng viên đã có dữ liệu thuộc vai trò đó trong đợt (đề tài hướng dẫn, phân công phản biện, ghế hội đồng chưa hủy) bị chặn và nêu lý do, theo tinh thần PDR-030; với file, dòng đó báo lỗi.

## Hệ quả

- Liên kết Giảng viên–đợt lưu ba cờ vai trò; các kiểm tra quyền GV hiện dựa vào "thuộc danh sách giảng viên của đợt" chuyển sang kiểm tra vai trò tương ứng.
- Kiểm thử: GV chỉ hội đồng không gửi được đề tài, GVHD bị khóa ở ô phản biện và bị chặn khi xếp vào hội đồng mình ngồi, nhập file có mã sai/trùng/không phải GV, ghi đè vai trò, bỏ vai trò khi đã có dữ liệu.
