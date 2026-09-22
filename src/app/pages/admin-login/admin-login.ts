import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
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
export class AdminLogin {
  hidePassword = true;
  username: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  onLogin(): void {
    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      username: this.username.trim(),
      email: this.username.trim(),
      password: this.password,
    };

    this.authService.adminLogin(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.token) {
          // 1. บันทึก Token
          this.authService.saveAdminToken(res.token);

          // 2. บันทึกข้อมูลแอดมิน (ถ้ามีส่งกลับมา)
          if (res.adminData) {
            this.authService.saveAdminData(res.adminData);
          }

          // นำทางไปยังหน้าแอดมินปกติหลังจากล็อกอินสำเร็จ
          this.router.navigate(['/admin']);
        } else {
          this.errorMessage = res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
        console.error('Admin login failed:', err);
      },
    });
  }
}
