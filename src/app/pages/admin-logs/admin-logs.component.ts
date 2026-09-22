import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  AdminUserService,
  ActivityLogItem,
  TodayStats,
  AdminUserItem,
} from '../../services/admin-user.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './admin-logs.component.html',
  styleUrl: './admin-logs.component.scss',
})
export class AdminLogsComponent implements OnInit {
  logs: ActivityLogItem[] = [];
  isLoading: boolean = false;

  // สรุปสถิติวันนี้
  stats: TodayStats = {
    todayLogins: 0,
    todayActivities: 0,
    activeAdminsToday: 0,
  };

  // ตัวเลือกตัวกรอง
  adminsList: AdminUserItem[] = [];
  selectedDateRange: 'today' | '7days' | '30days' | 'all' | 'custom' = 'today';
  startDate: string = '';
  endDate: string = '';
  selectedAdminId: number | null = null;
  selectedCategory: string = 'ALL';
  searchQuery: string = '';

  // Pagination
  currentPage: number = 1;
  pageSize: number = 20;
  totalItems: number = 0;
  totalPages: number = 1;

  // Cleanup state
  isCleaning: boolean = false;

  constructor(
    private adminUserService: AdminUserService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  ngOnInit(): void {
    this.setQuickDate('today', false);
    this.loadStats();
    this.loadAdminsList();
    this.loadLogs();
  }

  // กำหนดช่วงวันที่ด่วน
  setQuickDate(range: 'today' | '7days' | '30days' | 'all', reload: boolean = true): void {
    this.selectedDateRange = range;
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    if (range === 'today') {
      this.startDate = formatDateStr(today);
      this.endDate = formatDateStr(today);
    } else if (range === '7days') {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      this.startDate = formatDateStr(past7);
      this.endDate = formatDateStr(today);
    } else if (range === '30days') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      this.startDate = formatDateStr(past30);
      this.endDate = formatDateStr(today);
    } else if (range === 'all') {
      this.startDate = '';
      this.endDate = '';
    }

    this.cdr.detectChanges();

    if (reload) {
      this.currentPage = 1;
      this.loadLogs();
    }
  }

  onCustomDateChange(): void {
    this.selectedDateRange = 'custom';
    this.currentPage = 1;
    this.cdr.detectChanges();
    this.loadLogs();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.cdr.detectChanges();
    this.loadLogs();
  }

  loadStats(): void {
    this.adminUserService.getTodayStats().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.stats = res.stats;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Load Stats Error:', err);
      },
    });
  }

  loadAdminsList(): void {
    this.adminUserService.getAdmins().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.adminsList = res.admins;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Load Admins List Error:', err);
      },
    });
  }

  loadLogs(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.adminUserService
      .getLogs({
        page: this.currentPage,
        limit: this.pageSize,
        startDate: this.startDate || undefined,
        endDate: this.endDate || undefined,
        adminId: this.selectedAdminId || undefined,
        category: this.selectedCategory !== 'ALL' ? this.selectedCategory : undefined,
        search: this.searchQuery || undefined,
      })
      .subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            if (res.success) {
              this.logs = res.logs;
              this.totalItems = res.pagination.total;
              this.totalPages = res.pagination.totalPages;
              this.currentPage = res.pagination.page;
            }
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
            console.error('Load Logs Error:', err);
          });
        },
      });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.cdr.detectChanges();
      this.loadLogs();
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      AUTH: 'เข้า/ออกระบบ',
      STUDENT: 'ข้อมูลนักเรียน',
      SCORE: 'คะแนนการประเมิน',
      PROFILE: 'แก้ไขโปรไฟล์',
      NEWS: 'ข่าวสารและประกาศ',
      ADMIN: 'จัดการแอดมิน',
    };
    return labels[category] || category;
  }

  getCategoryClass(category: string): string {
    const classes: Record<string, string> = {
      AUTH: 'badge-auth',
      STUDENT: 'badge-student',
      SCORE: 'badge-score',
      PROFILE: 'badge-profile',
      NEWS: 'badge-news',
      ADMIN: 'badge-admin',
    };
    return classes[category] || 'badge-default';
  }

  getActionIcon(action: string, category: string): string {
    if (action === 'LOGIN') return 'login';
    if (action === 'LOGOUT') return 'logout';
    if (category === 'STUDENT') return 'school';
    if (category === 'SCORE') return 'grade';
    if (category === 'PROFILE') return 'how_to_reg';
    if (category === 'NEWS') return 'campaign';
    if (category === 'ADMIN') return 'admin_panel_settings';
    return 'info';
  }

  // ล้างประวัติกิจกรรมที่เก่ากว่า 1 ปี (Super Admin Only)
  onCleanupOldLogs(): void {
    Swal.fire({
      title: 'ยืนยันการล้างประวัติเก่ากว่า 1 ปี?',
      text: 'ระบบจะลบประวัติกิจกรรมทั้งหมดที่มีอายุเกิน 1 ปี (มากกว่า 365 วัน) ออกจากฐานข้อมูลอย่างถาวร (รายการประวัติล่าสุดจะไม่ได้รับผลกระทบ)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการล้างข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (result.isConfirmed) {
        this.isCleaning = true;
        this.cdr.detectChanges();

        this.adminUserService.cleanupOldLogs(365).subscribe({
          next: (res) => {
            this.ngZone.run(() => {
              this.isCleaning = false;
              this.cdr.detectChanges();
              Swal.fire({
                icon: 'success',
                title: 'ดำเนินการสำเร็จ',
                text: res.message || 'ล้างประวัติกิจกรรมเรียบร้อยแล้ว',
                confirmButtonColor: '#4338ca',
              });
              this.loadLogs();
              this.loadStats();
            });
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.isCleaning = false;
              this.cdr.detectChanges();
              Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: err.error?.message || 'ไม่สามารถล้างประวัติได้ กรุณาลองใหม่อีกครั้ง',
                confirmButtonColor: '#4338ca',
              });
            });
          },
        });
      }
    });
  }
}
