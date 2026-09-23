import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // ดึง Token ของ Admin (จาก sessionStorage เป็นหลัก)
  const adminToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token')
      : null;

  const studentToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('student_token') || localStorage.getItem('token')
      : null;

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

  // หาก Request มีการแนบ Header Authorization มาก่อนแล้ว ไม่ต้องเขียนทับ
  let cloned = req;
  if (!req.headers.has('Authorization') && tokenToUse) {
    cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${tokenToUse}`,
      },
    });
  }

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      // หากพบว่า Session หมดอายุ หรือไม่ได้รับอนุญาต (401/403) ขณะอยู่ในส่วน Admin
      if ((error.status === 401 || error.status === 403) && typeof window !== 'undefined') {
        const currentPath = window.location.pathname.toLowerCase();
        if (currentPath.includes('/admin') && !currentPath.includes('/admin/login')) {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_data');
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_data');
          router.navigate(['/admin/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
