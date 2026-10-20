import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class Admin implements OnInit {
  adminName: string = 'ผู้ดูแลระบบ';
  adminRole: string = 'admin';
  adminUsername: string = '';
  adminEmail: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAdminLoggedIn()) {
      this.router.navigate(['/admin/login']);
      return;
    }

    const data = this.authService.getAdminData();
    this.adminName = data?.name || data?.username || data?.email || 'ผู้ดูแลระบบ';
    this.adminRole = data?.role || 'admin';
    this.adminUsername = data?.username || (data?.email?.includes('@') ? data.email.split('@')[0] : data?.email) || '';
    this.adminEmail = data?.email || '';
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  onLogout(): void {
    Swal.fire({
      title: 'ออกจากระบบ',
      text: 'คุณต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.adminLogout();
        this.router.navigate(['/admin/login']);
      }
    });
  }
}
