import { Component, OnInit, OnDestroy, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { AdminLayoutService } from '../../../services/admin-layout.service';
import Swal from 'sweetalert2';

export interface MenuItem {
  title: string;
  route: string;
  icon: string;
  exact?: boolean;
  badge?: string;
  badgeClass?: string;
  superAdminOnly?: boolean;
}

export interface MenuCategory {
  name: string;
  icon?: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayout implements OnInit, OnDestroy {
  adminName: string = 'ผู้ดูแลระบบ';
  adminRole: string = 'admin';
  adminUsername: string = '';
  isSuperAdmin: boolean = false;

  isCollapsed: boolean = false;
  isMobileOpen: boolean = false;
  isMobileView: boolean = false;
  isNavigating: boolean = false;
  searchQuery: string = '';

  private subs = new Subscription();

  categories: MenuCategory[] = [
    {
      name: 'ภาพรวมระบบ',
      items: [
        { title: 'แดชบอร์ดหลัก', route: '/admin', icon: 'dashboard', exact: true }
      ]
    },
    {
      name: 'ข้อมูลหลักสูตร & นักเรียน',
      items: [
        { title: 'จัดการหลักสูตรและรายวิชา', route: '/admin/addcourse', icon: 'library_books' },
        { title: 'จัดการข้อมูลนักเรียน', route: '/admin/addstudent', icon: 'groups' },
        { title: 'อนุมัติการแก้ไขโปรไฟล์', route: '/admin/profile-approvals', icon: 'how_to_reg' },
        { title: 'จัดการข่าวสารและประกาศ', route: '/admin/news-management', icon: 'campaign' }
      ]
    },
    {
      name: 'คะแนนและผลการเรียน',
      items: [
        { title: 'แบบกรอกคะแนนนักเรียน', route: '/admin/scoremanagement', icon: 'edit_note' },
        { title: 'ตรวจสอบการส่งคะแนน', route: '/admin/score-submission', icon: 'fact_check' },
        { title: 'ผลการเรียนทั้งหมด (ทั้งรุ่น)', route: '/admin/classoverview', icon: 'assessment' },
        { title: 'จัดลำดับผลการเรียน (Ranking)', route: '/admin/ranking', icon: 'military_tech' },
        { title: 'บันทึกเวลาและคะแนนความประพฤติ', route: '/admin/training-exam-time', icon: 'timer' },
        { title: 'เลือกลงหน่วย', route: '/admin/unit-selection', icon: 'account_tree', badge: 'นนส./ช่าง', badgeClass: 'badge-teal' }
      ]
    },
    {
      name: 'แบบประเมิน',
      items: [
        { title: 'จัดการและสร้างแบบประเมิน', route: '/admin/form', icon: 'assignment' },
        { title: 'แสดงข้อมูลแบบประเมิน', route: '/admin/form-view', icon: 'visibility' },
        { title: 'บทสรุปฝึกอบรม', route: '/admin/training-summary', icon: 'auto_awesome' }
      ]
    },
    {
      name: 'เอกสารและใบรับรอง',
      items: [
        { title: 'ข้อมูลออกใบประกาศนียบัตร', route: '/admin/certificate', icon: 'card_membership' },
        { title: 'ข้อมูลระเบียนผลการเรียน (ผนวก ก.)', route: '/admin/transcript', icon: 'description' }
      ]
    },
    {
      name: 'ระบบและความปลอดภัย',
      items: [
        { title: 'จัดการผู้ดูแลระบบ', route: '/admin/users', icon: 'manage_accounts', superAdminOnly: true, badge: 'Super Admin', badgeClass: 'badge-indigo' },
        { title: 'ประวัติการทำงาน (Logs)', route: '/admin/logs', icon: 'history' }
      ]
    }
  ];

  constructor(
    private authService: AuthService,
    public layoutService: AdminLayoutService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkScreenSize();
    this.loadAdminProfile();
    this.updateFilteredCategories();

    this.subs.add(
      this.layoutService.isCollapsed$.subscribe(collapsed => {
        this.isCollapsed = collapsed;
        this.cdr.markForCheck();
      })
    );

    this.subs.add(
      this.layoutService.isMobileOpen$.subscribe(open => {
        this.isMobileOpen = open;
        this.cdr.markForCheck();
      })
    );

    // ดักจับสถานะเปลี่ยนหน้า เพื่อแสดง Loading bar และปิดเมนูมือถือ
    this.subs.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationStart) {
          this.isNavigating = true;
          this.cdr.markForCheck();
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.isNavigating = false;
          if (this.isMobileView && this.isMobileOpen) {
            this.layoutService.closeMobile();
          }
          this.cdr.markForCheck();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isMobileView = window.innerWidth <= 992;
      if (!this.isMobileView && this.isMobileOpen) {
        this.layoutService.closeMobile();
      }
      this.cdr.markForCheck();
    }
  }

  filteredCategories: MenuCategory[] = [];

  loadAdminProfile(): void {
    const data = this.authService.getAdminData();
    this.adminName = data?.name || data?.username || data?.email || 'ผู้ดูแลระบบ';
    this.adminRole = data?.role || 'admin';
    this.adminUsername = data?.username || '';
    this.isSuperAdmin = this.authService.isSuperAdmin();
  }

  updateFilteredCategories(): void {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!this.categories || !Array.isArray(this.categories)) {
      this.filteredCategories = [];
      return;
    }

    this.filteredCategories = this.categories
      .map(cat => {
        const items = cat.items || [];
        const visibleItems = items.filter(item => {
          if (item.superAdminOnly && !this.isSuperAdmin) return false;
          if (!q) return true;
          return item.title && item.title.toLowerCase().includes(q);
        });

        return {
          ...cat,
          items: visibleItems
        };
      })
      .filter(cat => cat.items.length > 0);
  }

  onSearchChange(): void {
    this.updateFilteredCategories();
  }

  trackByCategory(index: number, cat: MenuCategory): string {
    return cat.name;
  }

  trackByItem(index: number, item: MenuItem): string {
    return item.route;
  }

  toggleCollapse(): void {
    this.layoutService.toggleCollapse();
  }

  toggleMobile(): void {
    this.layoutService.toggleMobile();
  }

  closeMobile(): void {
    this.layoutService.closeMobile();
  }

  onLogout(): void {
    Swal.fire({
      title: 'ออกจากระบบ',
      text: 'คุณต้องการออกจากระบบผู้ดูแลระบบใช่หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.adminLogout();
        this.layoutService.closeMobile();
        this.router.navigate(['/admin/login']);
      }
    });
  }
}
