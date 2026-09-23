import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard ตรวจสอบสิทธิ์การเข้าถึงหน้าผู้ดูแลระบบ (Admin)
 * หากยังไม่ได้ล็อกอิน หรือปิดเบราว์เซอร์ไปแล้ว (Session หมดอายุ) จะเด้งกลับไปหน้าล็อกอินเสมอ
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdminLoggedIn()) {
    return true;
  }

  // หากไม่มี Session หรือไม่ได้ล็อกอิน ให้ Redirect ไปหน้า /admin/login ทันที
  router.navigate(['/admin/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
