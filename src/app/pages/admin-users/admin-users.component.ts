import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AdminUserService, AdminUserItem } from '../../services/admin-user.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  admins: AdminUserItem[] = [];
  isLoading: boolean = false;
  currentAdminId: number = 0;

  // Create Modal State
  showCreateModal: boolean = false;
  createForm = {
    name: '',
    username: '',
    password: '',
    role: 'admin' as 'superadmin' | 'admin',
  };
  isSubmittingCreate: boolean = false;

  // Reset Password Modal State
  showResetModal: boolean = false;
  selectedAdmin: AdminUserItem | null = null;
  resetPasswordForm = {
    newPassword: '',
    confirmPassword: '',
  };
  isSubmittingReset: boolean = false;

  constructor(
    private adminUserService: AdminUserService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // ป้องกันสิทธิ์: ถ้าไม่ใช่ Super Admin ให้ redirect กลับหน้า /admin ทันที
    if (!this.authService.isSuperAdmin()) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่มีสิทธิ์เข้าถึง',
        text: 'หน้านี้สงวนสิทธิ์เฉพาะผู้ดูแลระบบหลัก (Super Admin) เท่านั้น',
      }).then(() => {
        this.router.navigate(['/admin']);
      });
      return;
    }

    const currentData = this.authService.getAdminData();
    if (currentData) {
      this.currentAdminId = currentData.admin_id;
    }

    this.loadAdmins();
  }

  loadAdmins(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.adminUserService.getAdmins().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          if (res.success) {
            this.admins = res.admins;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          console.error('Load Admins Error:', err);

          if (err.status === 401 || err.status === 403) {
            Swal.fire({
              icon: 'warning',
              title: 'ต้องเข้าสู่ระบบใหม่',
              text: 'เซสชันหมดอายุ หรือต้องอัปเดตสิทธิ์ Super Admin กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
              confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
              confirmButtonColor: '#4338ca',
            }).then(() => {
              this.authService.adminLogout();
              this.router.navigate(['/admin/login']);
            });
            return;
          }

          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: err.error?.message || 'ไม่สามารถโหลดรายชื่อผู้ดูแลระบบได้ (เซิร์ฟเวอร์อาจกำลังรีสตาร์ต) กรุณาลองใหม่อีกครั้ง',
            showCancelButton: true,
            confirmButtonText: 'ลองใหม่อีกครั้ง',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#4338ca',
          }).then((alertRes) => {
            if (alertRes.isConfirmed) {
              this.loadAdmins();
            }
          });
        });
      },
    });
  }

  // --- Modal: เพิ่มแอดมินใหม่ ---
  openCreateModal(): void {
    this.createForm = {
      name: '',
      username: '',
      password: '',
      role: 'admin',
    };
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.cdr.detectChanges();
  }

  submitCreate(): void {
    const { name, username, password, role } = this.createForm;

    if (!name.trim() || !username.trim() || !password.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'กรอกข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกชื่อ-นามสกุล, ชื่อผู้ใช้ (Username) และรหัสผ่าน',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    // ตรวจสอบความยาวรหัสผ่าน (ไม่ง่ายเกินไป อย่างน้อย 6 ตัวอักษร)
    if (password.trim().length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'รหัสผ่านสั้นเกินไป',
        text: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรเพื่อความปลอดภัย',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    this.isSubmittingCreate = true;
    this.cdr.detectChanges();

    this.adminUserService
      .createAdmin({
        name: name.trim(),
        username: username.trim(),
        password: password.trim(),
        role,
      })
      .subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.isSubmittingCreate = false;
            this.closeCreateModal();
            this.cdr.detectChanges();

            Swal.fire({
              icon: 'success',
              title: 'บันทึกสำเร็จ!',
              text: res.message || 'เพิ่มผู้ดูแลระบบคนใหม่เรียบร้อยแล้ว',
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#4338ca',
              timer: 3000,
              timerProgressBar: true,
            });
            this.loadAdmins();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.isSubmittingCreate = false;
            this.cdr.detectChanges();
            console.error('Create Admin Error:', err);
            Swal.fire({
              icon: 'error',
              title: 'ไม่สามารถเพิ่มผู้ดูแลระบบได้',
              text: err.error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#4338ca',
            });
          });
        },
      });
  }

  // --- สลับสถานะ Active / Inactive ---
  toggleStatus(admin: AdminUserItem): void {
    if (admin.id === this.currentAdminId) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่อนุญาต',
        text: 'คุณไม่สามารถระงับการใช้งานบัญชีตนเองได้',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    const newStatus = admin.status === 'active' ? 'inactive' : 'active';
    const statusText = newStatus === 'active' ? 'เปิดใช้งาน' : 'ระงับการใช้งาน';

    Swal.fire({
      title: `ยืนยัน${statusText}`,
      text: `คุณต้องการ${statusText}บัญชีของ "${admin.name}" ใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: newStatus === 'active' ? '#0d9488' : '#ef4444',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminUserService
          .updateAdmin(admin.id, { status: newStatus })
          .subscribe({
            next: (res) => {
              this.ngZone.run(() => {
                Swal.fire({
                  icon: 'success',
                  title: 'สำเร็จ',
                  text: res.message,
                  timer: 2000,
                  timerProgressBar: true,
                  showConfirmButton: false,
                });
                this.loadAdmins();
              });
            },
            error: (err) => {
              this.ngZone.run(() => {
                this.cdr.detectChanges();
                Swal.fire({
                  icon: 'error',
                  title: 'เกิดข้อผิดพลาด',
                  text: err.error?.message || 'ไม่สามารถเปลี่ยนสถานะได้',
                  confirmButtonText: 'ตกลง',
                  confirmButtonColor: '#4338ca',
                });
              });
            },
          });
      }
    });
  }

  // --- สลับบทบาท Super Admin / Admin ---
  changeRole(admin: AdminUserItem, newRole: 'superadmin' | 'admin'): void {
    if (admin.role === newRole) return;

    const roleName = newRole === 'superadmin' ? 'ผู้ดูแลระบบหลัก (Super Admin)' : 'เจ้าหน้าที่ดูแลระบบ (Admin)';

    Swal.fire({
      title: 'เปลี่ยนระดับสิทธิ์',
      text: `ต้องการเปลี่ยนสิทธิ์ของ "${admin.name}" เป็น "${roleName}" ใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'เปลี่ยนสิทธิ์',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#4338ca',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminUserService
          .updateAdmin(admin.id, { role: newRole })
          .subscribe({
            next: (res) => {
              this.ngZone.run(() => {
                Swal.fire({
                  icon: 'success',
                  title: 'สำเร็จ',
                  text: res.message,
                  timer: 2000,
                  timerProgressBar: true,
                  showConfirmButton: false,
                });
                this.loadAdmins();
              });
            },
            error: (err) => {
              this.ngZone.run(() => {
                this.cdr.detectChanges();
                Swal.fire({
                  icon: 'error',
                  title: 'เกิดข้อผิดพลาด',
                  text: err.error?.message || 'ไม่สามารถเปลี่ยนสิทธิ์ได้',
                  confirmButtonText: 'ตกลง',
                  confirmButtonColor: '#4338ca',
                });
              });
            },
          });
      }
    });
  }

  // --- Modal: รีเซ็ตรหัสผ่าน ---
  openResetModal(admin: AdminUserItem): void {
    this.selectedAdmin = admin;
    this.resetPasswordForm = {
      newPassword: '',
      confirmPassword: '',
    };
    this.showResetModal = true;
    this.cdr.detectChanges();
  }

  closeResetModal(): void {
    this.showResetModal = false;
    this.selectedAdmin = null;
    this.cdr.detectChanges();
  }

  submitResetPassword(): void {
    if (!this.selectedAdmin) return;
    const { newPassword, confirmPassword } = this.resetPasswordForm;

    if (!newPassword.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกรหัสผ่านใหม่',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    if (newPassword.trim().length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'รหัสผ่านสั้นเกินไป',
        text: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'รหัสผ่านไม่ตรงกัน',
        text: 'กรุณากรอกรหัสผ่านยืนยันให้ตรงกับรหัสผ่านใหม่',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    this.isSubmittingReset = true;
    this.cdr.detectChanges();

    this.adminUserService
      .resetPassword(this.selectedAdmin.id, newPassword.trim())
      .subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.isSubmittingReset = false;
            this.closeResetModal();
            this.cdr.detectChanges();
            Swal.fire({
              icon: 'success',
              title: 'รีเซ็ตรหัสผ่านสำเร็จ',
              text: res.message || 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว',
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#4338ca',
              timer: 2500,
              timerProgressBar: true,
            });
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.isSubmittingReset = false;
            this.cdr.detectChanges();
            console.error('Reset Password Error:', err);
            Swal.fire({
              icon: 'error',
              title: 'เกิดข้อผิดพลาด',
              text: err.error?.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้',
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#4338ca',
            });
          });
        },
      });
  }

  // --- ลบแอดมิน ---
  deleteAdmin(admin: AdminUserItem): void {
    if (admin.id === this.currentAdminId) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่อนุญาต',
        text: 'คุณไม่สามารถลบบัญชีตนเองได้',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4338ca',
      });
      return;
    }

    Swal.fire({
      title: 'ยืนยันการลบผู้ดูแลระบบ',
      html: `คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีของ <b>${admin.name}</b> (@${admin.username || admin.email})?<br><span style="color: #ef4444; font-size: 13px;">การกระทำนี้ไม่สามารถย้อนกลับได้</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบบัญชี',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminUserService.deleteAdmin(admin.id).subscribe({
          next: (res) => {
            this.ngZone.run(() => {
              Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ',
                text: res.message,
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false,
              });
              this.loadAdmins();
            });
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.cdr.detectChanges();
              Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: err.error?.message || 'ไม่สามารถลบผู้ดูแลระบบได้',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#4338ca',
              });
            });
          },
        });
      }
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'ยังไม่เคยเข้าสู่ระบบ';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }
}
