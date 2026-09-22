import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // หาก Request มีการแนบ Header Authorization มาก่อนแล้ว ไม่ต้องเขียนทับ
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const adminToken = localStorage.getItem('admin_token');
  const studentToken =
    localStorage.getItem('student_token') || localStorage.getItem('token');

  // ตรวจสอบว่าผู้ใช้กำลังอยู่ในหน้า Admin หรือไม่
  const isAdminPath =
    typeof window !== 'undefined' &&
    window.location.pathname.toLowerCase().includes('/admin');

  let tokenToUse: string | null = null;

  if (isAdminPath) {
    tokenToUse = adminToken;
  } else {
    tokenToUse = studentToken || adminToken;
  }

  // Fallback: ถ้ายังไม่มี ให้ใช้ Token ตัวใดตัวหนึ่งที่มีอยู่ในเครื่อง
  if (!tokenToUse) {
    tokenToUse = adminToken || studentToken;
  }

  // หากมี Token ให้แนบไปกับ Header Authorization
  if (tokenToUse) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${tokenToUse}`,
      },
    });
    return next(cloned);
  }

  return next(req);
};
