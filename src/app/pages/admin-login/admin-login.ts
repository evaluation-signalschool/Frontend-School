import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
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
export class AdminLogin implements OnInit {
  hidePassword = true;
  username: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // หากเข้าสู่ระบบไว้แล้ว และมีข้อมูลครบถ้วน ให้พาไปหน้าหลักแอดมินทันที
    if (this.authService.isAdminLoggedIn() && this.authService.getAdminData()) {
      this.router.navigate(['/admin']);
    }
  }

  onLogin(): void {
    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบ';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      username: this.username.trim(),
      password: this.password,
    };

    this.authService.adminLogin(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.token) {
          // 1. บันทึก Token ลง sessionStorage
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
