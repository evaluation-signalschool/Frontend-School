import { Component, OnInit, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';

import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CourseService } from '../services/course.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatMenuModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
})
export class Header implements OnInit {
  isAdmin = false;
  // สร้าง Array มารอรับข้อมูลจาก Backend
  // โครงสร้างเมนูของคุณ (แก้ไขตามที่มีอยู่จริง)
  menuData: any[] = [
    {
      title: 'สำหรับผู้เรียน',
      path: '/student',
      submenus: [], // เราจะเอาข้อมูล API มายัดใส่ตรงนี้
    },
    {
      title: 'สำหรับครู-อาจารย์',
      path: '/teacher',
      submenus: [], // เราจะเอาข้อมูล API มายัดใส่ตรงนี้
    },
    {
      title: 'สำหรับคณะกับกำหลักสูตร',
      path: '/committee',
      submenus: [], // เราจะเอาข้อมูล API มายัดใส่ตรงนี้
    },
    {
      title: 'แบบประเมินติดตามผู้สำเร็จฯ',
      path: '/follow-up',
      submenus: [], // เราจะเอาข้อมูล API มายัดใส่ตรงนี้
    },
    {
      title: 'สรุปผลการฝึกอบรม',
      path: '/training-results',

      simpleItems: [
        { title: 'ชั้นนายพัน', courseName: 'ชั้นนายพัน' },
        { title: 'นายสิบอาวุโส', courseName: 'นายสิบอาวุโส' },
        { title: 'นายสิบชั้นต้น', courseName: 'นายสิบชั้นต้น' },
        { title: 'ช่างอิเล็กทรอนิกส์', courseName: 'ช่างอิเล็กทรอนิกส์' },
        { title: 'นักเรียนนายสิบ เหล่า ส.', courseName: 'นักเรียนนายสิบ เหล่า ส.' }
        ], // เราจะเอาข้อมูล API มายัดใส่ตรงนี้
    },
    {
      title: 'สรุปผลการประเมินฯ',
      path: '/evaluation-summary',
      simpleItems: [
        'ชั้นนายพัน',
        'ชั้นนายร้อย',
        'นายสิบอาวุโส (เร่งรัด)',
        'นายสิบชั้นต้น (เร่งรัด)',
        'ช่างอิเล็กทรอนิกส์',
        'นนส.ทบ.',
      ], // เราจะเอาข้อมูล API มายัดใส่ตรงนี้
    },
  ];

  constructor(
    private courseService: CourseService,
    private router: Router,
  ) {
    // เช็ก URL ตั้งแต่เปิดหน้าเว็บครั้งแรก
    this.checkRoute(this.router.url);

    // ดักฟังทุกครั้งที่ผู้ใช้งานคลิกเปลี่ยนหน้าเว็บในระบบ
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.checkRoute(event.url);
      });
  }

  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.fetchCourses();
  }

  // ⚡ แก้ไขฟังก์ชัน checkRoute ในไฟล์ header.ts ของคุณให้เป็นแบบนี้
  private checkRoute(url: string): void {
    if (!url) return;

    // แปลงเป็นตัวพิมพ์เล็กทั้งหมดเพื่อป้องกัน Error จากพิมพ์เล็กพิมพ์ใหญ่ เช่น /Admin หรือ /Admin/dashboard
    const lowerUrl = url.toLowerCase();

    this.isAdmin = lowerUrl.includes('/admin');

    // เปิดคอนโซลใน Browser (กด F12) ดูว่าหน้าปัจจุบัน URL คืออะไร และระบบมองว่าเป็นแอดมินไหม
    console.log('Current URL:', lowerUrl, 'Is Admin?:', this.isAdmin);
  }

  fetchCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (response) => {
        if (response.success) {
          // กรองเอาเฉพาะรุ่นที่ is_active เป็น true
          const activeData = response.data.map((course: any) => ({
            ...course,
            batches: (course.batches || []).filter((b: any) => b.is_active !== false)
          }));

          // หา index ของเมนูที่ชื่อ 'สำหรับผู้เรียน'
          const studentMenuIndex = this.menuData.findIndex((m) => m.title === 'สำหรับผู้เรียน');
          if (studentMenuIndex !== -1) {
            // เอาข้อมูลจาก API ยัดเข้าไปแทนที่
            this.menuData[studentMenuIndex].submenus = activeData;
          }

          // หา index ของเมนูที่ชื่อ 'สำหรับครู-อาจารย์'
          const teacherMenuIndex = this.menuData.findIndex((m) => m.title === 'สำหรับครู-อาจารย์');
          if (teacherMenuIndex !== -1) {
            // เอาข้อมูลจาก API ยัดเข้าไปแทนที่
            this.menuData[teacherMenuIndex].submenus = activeData;
          }

          // 3. ใส่ข้อมูลให้เมนู "สำหรับคณะกับกำหลักสูตร"
          const committeeMenuIndex = this.menuData.findIndex(
            (m) => m.title === 'สำหรับคณะกับกำหลักสูตร',
          );
          if (committeeMenuIndex !== -1) {
            this.menuData[committeeMenuIndex].submenus = activeData;
          }

          // 4. ใส่ข้อมูลให้เมนู "แบบประเมินติดตามผู้สำเร็จฯ"
          const followUpMenuIndex = this.menuData.findIndex(
            (m) => m.title === 'แบบประเมินติดตามผู้สำเร็จฯ',
          );
          if (followUpMenuIndex !== -1) {
            this.menuData[followUpMenuIndex].submenus = activeData;
          }

          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('API Error:', error);
      },
    });
  }

  goToPage(path: string, courseName: string, batch: any): void {
    if (!path) {
      console.error('ไม่พบ Path ปลายทาง เช็คว่าใส่ path ใน menuData หรือยัง!');
      return;
    }

    // สั่งเปลี่ยนหน้าและแนบ Query Params ไปด้วย
    this.router.navigate([path], {
      queryParams: {
        batchId: batch.batch_id,
        title: courseName + ' ' + batch.batch_name,
      },
    });
  }

  // ใช้เช็คว่า Menu นี้กำลัง Active อยู่หรือไม่ โดยเทียบจาก URL
  isActive(path: string): boolean {
    if (!path) return false;
    return this.router.url.includes(path);
  }
}
