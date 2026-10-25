import type { ApiResponse } from '@/types/api';

// Lỗi từ API kèm mã HTTP để nơi gọi phân biệt hết phiên (401) với lỗi khác.
// status = 0 nghĩa là không kết nối được máy chủ.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // FormData (tải tệp) phải để trình duyệt tự đặt Content-Type kèm boundary.
  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: isFormData
        ? { ...init?.headers }
        : { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(
      'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
      0,
    );
  }
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      `Backend unavailable (HTTP ${response.status})`,
      response.status,
    );
  }
  if (!response.ok || !body.success) {
    throw new ApiError(
      body.message || `HTTP ${response.status}`,
      response.status,
    );
  }
  return body.data;
}
