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

  // ตรวจสอบว่าอยู่ในส่วนของ Admin หรือไม่ (ทั้งหน้าเว็บ และ API Endpoint)
  const isInAdminPage = currentPath.startsWith('/admin') || routerUrl.startsWith('/admin');
  const isAdminEndpoint =
    reqUrl.includes('/admin/') ||
    reqUrl.includes('/edit-profile/requests') ||
    reqUrl.includes('/logs') ||
    reqUrl.includes('/users');

  // ตรวจสอบว่ากำลังทำงานในส่วนของนักเรียนหรือไม่
  // หากอยู่ในหน้า Admin หรือยิง API ฝั่ง Admin จะต้องไม่เป็น student area เด็ดขาด
  const isStudentArea =
    !isInAdminPage &&
    !isAdminEndpoint &&
    (currentPath.startsWith('/student') ||
      routerUrl.startsWith('/student') ||
      currentPath === '/edit-profile' ||
      routerUrl === '/edit-profile' ||
      currentPath === '/score' ||
      routerUrl === '/score' ||
      currentPath === '/register' ||
      routerUrl === '/register' ||
      (reqUrl.includes('/edit-profile') && !reqUrl.includes('/edit-profile/requests')) ||
      reqUrl.includes('/student/'));

  // ตัดสินใจเลือก Token ที่ถูกต้อง
  // หากอยู่ในส่วนแอดมิน ให้ใช้ adminToken เป็นลำดับแรกเสมอ เพื่อไม่ให้ชนกับ verifyAdmin บน Backend
  // หากอยู่ในส่วนนักเรียน ให้ใช้ studentToken
  let tokenToUse: string | null = null;
  if (isInAdminPage || isAdminEndpoint) {
    tokenToUse = adminToken;
  } else if (isStudentArea) {
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

    const isInAdminOrHasAdminToken = (isInAdminPage || isAdminEndpoint) && adminToken;
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

        // ห้ามเตะออกหากเป็นเพียง Error การไม่มีสิทธิ์ (Role insufficient)
        const isPermissionOnly =
          errMsg.includes('super admin access required') ||
          errMsg.includes('สิทธิ์การเข้าถึงสำหรับผู้ดูแลระบบหลักเท่านั้น') ||
          errMsg.includes('admin access required') ||
          errMsg.includes('สิทธิ์การเข้าถึงสำหรับแอดมินเท่านั้น') ||
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

