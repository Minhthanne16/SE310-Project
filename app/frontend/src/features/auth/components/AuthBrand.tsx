import React from 'react';

// Panel trái dùng chung cho Đăng nhập và Quên mật khẩu (artboard DangNhap, QuenMatKhau).
// Chưa có API đợt hiện tại nên chỉ hiển thị tên khoa; không in placeholder của design.
export const AuthBrand: React.FC = () => (
  <section className="login-brand">
    <div className="login-brand-logo">
      <span>Q</span>
      QLKLTN
    </div>
    <div className="login-brand-copy">
      <h1>
        Khóa luận tốt nghiệp, <em>gọn trong một nơi.</em>
      </h1>
      <p>
        Đăng ký đề tài, nộp đề cương và khóa luận, chấm điểm và nhận kết quả.
      </p>
    </div>
    <div className="login-brand-footer">
      <span>Khoa Công nghệ Phần mềm</span>
    </div>
  </section>
);
