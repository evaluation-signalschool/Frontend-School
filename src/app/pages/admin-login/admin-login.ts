import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
})
export class AdminLogin implements OnInit {
  hidePassword = true;
  username: string = '';
  password: string = '';
  rememberMe: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    // โหลดชื่อผู้ใช้ที่จำไว้ก่อนหน้า หากผู้ใช้เคยเลือกจดจำการเข้าสู่ระบบ
    if (typeof window !== 'undefined') {
      try {
        const savedRemember = localStorage.getItem('admin_remember_me');
        const savedUsername = localStorage.getItem('admin_remembered_username');
        if (savedRemember === 'true') {
          this.rememberMe = true;
          if (savedUsername) {
            this.username = savedUsername;
          }
        }
      } catch (_) {}
    }

    // หากเข้าสู่ระบบไว้แล้ว และมีข้อมูลครบถ้วน ให้พาไปหน้าหลักแอดมินทันที
    if (this.authService.isAdminLoggedIn() && this.authService.getAdminData()) {
      this.router.navigate(['/admin']);
    }
  }

  onLogin(): void {
    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ';
      Swal.fire({
        icon: 'warning',
        title: 'แจ้งเตือน',
        text: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน',
        confirmButtonColor: '#7b3fa0',
        confirmButtonText: 'ตกลง',
      });
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const payload = {
      username: this.username.trim(),
      password: this.password,
      rememberMe: this.rememberMe,
    };

    this.authService.adminLogin(payload).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          if (res.success && res.token) {
            // บันทึกหรือลบสถานะจดจำผู้ใช้ตามตัวเลือก
            if (typeof window !== 'undefined') {
              try {
                if (this.rememberMe) {
                  localStorage.setItem('admin_remember_me', 'true');
                  localStorage.setItem('admin_remembered_username', this.username.trim());
                } else {
                  localStorage.removeItem('admin_remember_me');
                  localStorage.removeItem('admin_remembered_username');
                }
              } catch (_) {}
            }

            // 1. บันทึก Token ลง Storage
            this.authService.saveAdminToken(res.token);

            // 2. บันทึกข้อมูลแอดมิน (ถ้ามีส่งกลับมา)
            if (res.adminData) {
              this.authService.saveAdminData(res.adminData);
            }

            // 3. นำทางไปยังหน้าปลายทางเดิมที่พยายามเข้า หรือ /admin
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin';
            this.router.navigateByUrl(returnUrl);
          } else {
            this.errorMessage = res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            Swal.fire({
              icon: 'error',
              title: 'เข้าสู่ระบบไม่สำเร็จ',
              text: this.errorMessage,
              confirmButtonColor: '#7b3fa0',
              confirmButtonText: 'ตกลง',
            });
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          const msg =
            err.error?.message ||
            (err.status === 401
              ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
              : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
          this.errorMessage = msg;
          console.error('Admin login failed:', err);

          Swal.fire({
            icon: 'error',
            title: 'เข้าสู่ระบบไม่สำเร็จ',
            text: msg,
            confirmButtonColor: '#7b3fa0',
            confirmButtonText: 'ตกลง',
          });

          this.cdr.detectChanges();
        });
      },
    });
  }
}
