import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ==========================================
// 1. Interfaces สำหรับ Authentication (Login)
// ==========================================
export interface StudentData {
  student_id: number;
  batch_id: number;
  student_code?: string;
  first_name: string;
  last_name: string;
  rank_name: string;
  course_name?: string;
  batch_name?: string;
  status?: string;
}

export interface StudentLoginRequest {
  batch_id: number;
  student_code: string;
  password: string;
}

export interface StudentLoginResponse {
  success: boolean;
  message: string;
  token?: string;
  studentData?: StudentData;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}

  // ฟังก์ชันยิง API Login
  studentLogin(payload: StudentLoginRequest): Observable<StudentLoginResponse> {
    return this.http.post<StudentLoginResponse>(`${environment.apiUrl}/student-login`, payload);
  }

  // บันทึก Token ลง localStorage
  saveToken(token: string): void {
    localStorage.setItem('student_token', token);
  }

  // ดึง Token จาก localStorage
  getToken(): string | null {
    return localStorage.getItem('student_token');
  }

  // บันทึกข้อมูลนักเรียนลง localStorage
  saveStudentData(data: StudentData): void {
    localStorage.setItem('student_data', JSON.stringify(data));
  }

  // ดึงข้อมูลนักเรียนจาก localStorage
  getStudentData(): StudentData | null {
    const data = localStorage.getItem('student_data');
    return data ? JSON.parse(data) : null;
  }

  // ออกจากระบบ
  logout(): void {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_data');
  }

  // ตรวจสอบว่า Login อยู่หรือไม่
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // ==========================================
  // ส่วนของ Admin
  // ==========================================

  // ==========================================
  // ส่วนของ Admin (ใช้ sessionStorage เพื่อความปลอดภัย ปิดหน้าเว็บแล้วหมดอายุทันที)
  // ==========================================

  // ฟังก์ชันยิง API Admin Login
  adminLogin(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/admin/login`, payload);
  }

  // บันทึก Admin Token ลง sessionStorage (ป้องกันการเข้าค้างไว้เมื่อปิดเบราว์เซอร์)
  saveAdminToken(token: string): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('admin_token', token);
      localStorage.removeItem('admin_token'); // เคลียร์ของเก่าใน localStorage เพื่อความปลอดภัย
    }
  }

  // ดึง Admin Token จาก sessionStorage
  getAdminToken(): string | null {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('admin_token');
    }
    return null;
  }

  // บันทึกข้อมูล Admin ลง sessionStorage
  saveAdminData(data: any): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('admin_data', JSON.stringify(data));
      localStorage.removeItem('admin_data'); // เคลียร์ของเก่าใน localStorage
    }
  }

  // ดึงข้อมูล Admin จาก sessionStorage
  getAdminData(): any | null {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const data = sessionStorage.getItem('admin_data');
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  // ตรวจสอบว่าเป็น Super Admin หรือไม่
  isSuperAdmin(): boolean {
    const data = this.getAdminData();
    return data?.role === 'superadmin';
  }

  // ดึง Role ของ Admin
  getAdminRole(): string {
    const data = this.getAdminData();
    return data?.role || 'admin';
  }

  // ดึงชื่อของ Admin
  getAdminName(): string {
    const data = this.getAdminData();
    return data?.name || data?.username || data?.email || 'ผู้ดูแลระบบ';
  }

  // ตรวจสอบว่า Admin Login อยู่หรือไม่ (และ Token ยังไม่หมดอายุ)
  isAdminLoggedIn(): boolean {
    const token = this.getAdminToken();
    if (!token) return false;

    // ตรวจสอบวันหมดอายุของ JWT Token ถ้ามีฟิลด์ exp
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          this.adminLogout();
          return false;
        }
      }
    } catch (_) {}

    return true;
  }

  // ออกจากระบบ Admin
  adminLogout(): void {
    const token = this.getAdminToken() || (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null);
    if (token) {
      try {
        this.http.post(`${environment.apiUrl}/admin/logout`, {}).subscribe({
          next: () => {},
          error: () => {},
        });
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_data');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_data');
    }
  }
}
