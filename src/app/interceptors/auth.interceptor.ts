import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // ดึง Token ของ Admin (ตรวจทั้ง sessionStorage และ localStorage)
  const adminToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token')
      : null;

  // ดึง Token ของนักเรียน
  const studentToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('student_token') || localStorage.getItem('token')
      : null;

  const reqUrl = req.url.toLowerCase();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const routerUrl = router.url ? router.url.toLowerCase() : '';

  // ตรวจสอบว่ากำลังทำงานในส่วนของนักเรียนหรือไม่
  const isStudentArea =
    currentPath.startsWith('/student') ||
    routerUrl.startsWith('/student') ||
    reqUrl.includes('/student/login') ||
    reqUrl.includes('/student/register');

  // ตัดสินใจเลือก Token ที่ถูกต้อง
  // หากอยู่ในส่วนนักเรียนให้ใช้ studentToken
  // หากอยู่ในส่วนอื่นๆ หรือแอดมิน ให้ใช้ adminToken เป็นลำดับแรกเสมอ เพื่อไม่ให้ชนกับ verifyAdmin บน Backend
  let tokenToUse: string | null = null;
  if (isStudentArea) {
    tokenToUse = studentToken || adminToken;
  } else if (adminToken) {
    tokenToUse = adminToken;
  } else {
    tokenToUse = studentToken;
  }

  let cloned = req;
  const currentAuth = req.headers.get('Authorization');

  // ตรวจสอบว่าเป็น Request ยิงไป Backend ของระบบเราหรือไม่ (ไม่แตะ API ภายนอก เช่น Google Gemini API)
  const isBackendApi = req.url.startsWith(environment.apiUrl);

  // ไม่แนบ Token ไปกับหน้า Login/Register โดยไม่จำเป็น
  const isAuthEndpoint =
    reqUrl.includes('/admin/login') ||
    reqUrl.includes('/student/login') ||
    reqUrl.includes('/student/register');

  if (isBackendApi && !isAuthEndpoint && tokenToUse) {
    const isInvalidAuth =
      !currentAuth ||
      currentAuth === 'Bearer null' ||
      currentAuth === 'Bearer undefined' ||
      currentAuth.trim() === 'Bearer';

    const isInAdminOrHasAdminToken = !isStudentArea && adminToken;
    const isRogueToken =
      currentAuth &&
      isInAdminOrHasAdminToken &&
      currentAuth !== `Bearer ${adminToken}`;

    // ถ้ายังไม่มี Authorization header, หรือมีค่าเป็น null, หรือส่ง Token ผิดตัวในส่วน Admin
    // ให้บังคับใช้ Token ที่ถูกต้องทันที
    if (isInvalidAuth || isRogueToken) {
      cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${tokenToUse}`,
        },
      });
    }
  }

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (typeof window !== 'undefined' && isBackendApi) {
        const path = window.location.pathname.toLowerCase();
        const isInAdmin = path.includes('/admin') && !path.includes('/admin/login');

        const errMsg = (error.error?.message || error.message || '').toLowerCase();
        const currentStoredAdminToken =
          sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');

        // ตรวจสอบว่าเป็นการหมดอายุของเซสชันจริงๆ หรือไม่
        // 1. ถ้าไม่มี Token ใน Storage เลยขณะอยู่ในหน้าแอดมิน
        // 2. หรือเซิร์ฟเวอร์แจ้งว่า Token Expired / Invalid Token จริงๆ
        const isRealSessionExpiration =
          !currentStoredAdminToken ||
          ((error.status === 401 || error.status === 403) &&
            (errMsg.includes('expired') ||
              errMsg.includes('หมดอายุ') ||
              errMsg.includes('invalid') ||
              errMsg.includes('เซสชันหมดอายุ')));

        // ห้ามเตะออกหากเป็นเพียง Error การไม่มีสิทธิ์ Super Admin (Role insufficient)
        const isPermissionOnly =
          errMsg.includes('super admin access required') ||
          errMsg.includes('สิทธิ์การเข้าถึงสำหรับผู้ดูแลระบบหลักเท่านั้น') ||
          errMsg.includes('ถูกระงับการใช้งาน');

        if (isInAdmin && isRealSessionExpiration && !isPermissionOnly) {
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

