# Quy tắc nghiệp vụ

## Đợt, đề tài và nhóm

- Một đề tài thuộc một đợt; một nhóm có một hoặc hai Sinh viên và đúng một đại diện.
- Mỗi Sinh viên chỉ thuộc một nhóm trong cùng một đợt.
- Đề tài công bố có trạng thái `Chưa đăng ký` cho đến khi một nhóm đăng ký thành công. Nếu nhóm hủy đăng ký, đề tài quay lại `Chưa đăng ký`.
- Đề tài do Sinh viên đề xuất bắt đầu ở `Chờ GV duyệt`. Chỉ giảng viên hướng dẫn được nêu trong đề xuất có quyền chấp nhận/từ chối; từ chối phải có lý do và vẫn lưu lịch sử.
- Hệ thống phải bảo đảm không có hai nhóm cùng nhận một đề tài. Giới hạn số đề tài tối thiểu/tối đa của giảng viên chỉ để cảnh báo, không chặn thao tác.
- Chuỗi trạng thái chính là `Đã đăng ký` → `Đang thực hiện` → `Đã cho điểm` → `Đã hoàn tất`. Xem `OPEN_QUESTIONS.md` cho nhánh hủy còn chưa chốt.

## Tài liệu và phân công

- Đề cương phải được giảng viên hướng dẫn duyệt trước khi đề tài chuyển `Đang thực hiện`.
- Việc yêu cầu chỉnh sửa tạo cơ sở cho nhóm nộp lại; các phiên bản tài liệu cần giữ để truy vết.
- Giảng viên hướng dẫn không được là phản biện hay thành viên hội đồng của cùng đề tài.
- Một hội đồng có đúng chủ tịch và thư ký; mỗi giảng viên chỉ giữ một vai trò trong cùng hội đồng.

## Chấm điểm và kết quả

- Điểm được nhập riêng cho từng Sinh viên, không dùng một điểm chung cho toàn nhóm.
- Mỗi Sinh viên cần bốn thành phần: chủ tịch (CTHĐ), thư ký (TKHĐ), hướng dẫn (CBHD) và phản biện (CBPB). Chỉ tính điểm khi đủ bốn giá trị.
- Công thức: `(CTHĐ + TKHĐ + 2 × CBHD + 2 × CBPB) / 6`, theo thang 10 và làm tròn hai chữ số thập phân.
- Cảnh báo lệch điểm khi chênh lệch tuyệt đối giữa điểm chủ tịch/thư ký và điểm hướng dẫn/phản biện từ 2 điểm trở lên. Cảnh báo không chặn lưu điểm nhưng phải hiển thị cho Giáo vụ khi xác nhận.
- Đề tài chỉ chuyển `Đã cho điểm` khi mọi Sinh viên trong nhóm có đủ bốn phiếu; kết quả đã xác nhận không được sửa.
- Công bố kết quả yêu cầu đã xác nhận và điều kiện bản khóa luận cuối theo báo cáo; sau công bố, đề tài `Đã hoàn tất`.

## Truy vết và tài khoản

- Các thay đổi quan trọng như đăng ký, xét đề xuất, duyệt đề cương, phân công, thay đổi điểm, xác nhận và công bố phải có lịch sử.
- Tài khoản đã có dữ liệu cần vô hiệu hóa thay vì xóa vật lý; Giáo vụ không được xóa chính mình.
- "Đã có dữ liệu" nghĩa là có bất kỳ bản ghi nào trong hệ thống tham chiếu tới tài khoản (đơn đăng ký, đề xuất, đề tài, phân công, hội đồng, phiếu điểm, thông báo…). Chỉ tài khoản chưa có bản ghi liên quan nào mới được xóa hẳn; backend kiểm tra khi xóa.
- Mã người dùng và vai trò không đổi sau khi tạo tài khoản; Giáo vụ chỉ sửa các thông tin còn lại.
- Quyền truy cập thực thi ở backend, không chỉ bằng cách ẩn/hiện giao diện.
