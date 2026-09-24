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

  // บันทึก Admin Token ทั้งใน sessionStorage และ localStorage เพื่อความเสถียรข้ามแท็บ
  saveAdminToken(token: string): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('admin_token', token);
      } catch (_) {}
      try {
        localStorage.setItem('admin_token', token);
      } catch (_) {}
    }
  }

  // ดึง Admin Token จาก sessionStorage (หรือ localStorage)
  getAdminToken(): string | null {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('admin_token') ||
        localStorage.getItem('admin_token')
      );
    }
    return null;
  }

  // บันทึกข้อมูล Admin ทั้งใน sessionStorage และ localStorage
  saveAdminData(data: any): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('admin_data', JSON.stringify(data));
      } catch (_) {}
      try {
        localStorage.setItem('admin_data', JSON.stringify(data));
      } catch (_) {}
    }
  }

  // ถอดรหัส JWT Token อย่างปลอดภัย (รองรับ Base64URL และภาษาไทย)
  private decodeJwt(token: string): any | null {
    try {
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      try {
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (_) {
        return JSON.parse(atob(base64));
      }
    } catch (_) {
      return null;
    }
  }

  // ดึงข้อมูล Admin จาก sessionStorage / localStorage หรือถอดรหัสจาก Token
  getAdminData(): any | null {
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('admin_data');
      if (sessionData) {
        try {
          return JSON.parse(sessionData);
        } catch (_) {}
      }
      const localData = localStorage.getItem('admin_data');
      if (localData) {
        try {
          return JSON.parse(localData);
        } catch (_) {}
      }
    }

    // หากไม่มีใน Storage แต่มี Token อยู่ ให้ถอดรหัสข้อมูลจาก JWT Token
    const token = this.getAdminToken();
    if (token) {
      const decoded = this.decodeJwt(token);
      if (decoded) {
        const adminData = {
          admin_id: decoded.admin_id || decoded.id,
          username: decoded.username || '',
          name: decoded.name || decoded.username || 'ผู้ดูแลระบบ',
          role: decoded.role || 'admin',
          status: decoded.status || 'active',
        };
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('admin_data', JSON.stringify(adminData));
          } catch (_) {}
          try {
            localStorage.setItem('admin_data', JSON.stringify(adminData));
          } catch (_) {}
        }
        return adminData;
      }
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
      const payload = this.decodeJwt(token);
      if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
        this.adminLogout();
        return false;
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
