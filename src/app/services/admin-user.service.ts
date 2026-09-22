import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUserItem {
  id: number;
  username?: string;
  email?: string;
  name: string;
  role: 'superadmin' | 'admin';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ActivityLogItem {
  id: number;
  admin_id: number;
  admin_name: string;
  admin_username?: string;
  admin_email: string;
  action: string;
  action_category: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TodayStats {
  todayLogins: number;
  todayActivities: number;
  activeAdminsToday: number;
}

@Injectable({
  providedIn: 'root',
})
export class AdminUserService {
  constructor(private http: HttpClient) {}

  // ==========================================
  // จัดการผู้ดูแลระบบ (Admin Users)
  // ==========================================

  // ดึงรายชื่อแอดมินทั้งหมด
  getAdmins(): Observable<{ success: boolean; admins: AdminUserItem[] }> {
    return this.http.get<{ success: boolean; admins: AdminUserItem[] }>(
      `${environment.apiUrl}/admin/users`
    );
  }

  // เพิ่มผู้ดูแลระบบใหม่
  createAdmin(payload: {
    username: string;
    email?: string;
    password: string;
    name: string;
    role: string;
  }): Observable<{ success: boolean; message: string; adminId?: number }> {
    return this.http.post<{ success: boolean; message: string; adminId?: number }>(
      `${environment.apiUrl}/admin/users`,
      payload
    );
  }

  // แก้ไขข้อมูลผู้ดูแลระบบ
  updateAdmin(
    id: number,
    payload: { name?: string; role?: string; status?: string }
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${environment.apiUrl}/admin/users/${id}`,
      payload
    );
  }

  // รีเซ็ตรหัสผ่านแอดมิน
  resetPassword(
    id: number,
    newPassword: string
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${environment.apiUrl}/admin/users/${id}/reset-password`,
      { newPassword }
    );
  }

  // ลบผู้ดูแลระบบ
  deleteAdmin(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${environment.apiUrl}/admin/users/${id}`
    );
  }

  // ==========================================
  // จัดการประวัติกิจกรรม (Activity & Audit Logs)
  // ==========================================

  // ดึงประวัติกิจกรรมการทำงาน
  getLogs(params: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    adminId?: number | null;
    category?: string;
    search?: string;
  }): Observable<{
    success: boolean;
    logs: ActivityLogItem[];
    pagination: PaginationData;
  }> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
    if (params.adminId) httpParams = httpParams.set('adminId', params.adminId.toString());
    if (params.category && params.category !== 'ALL')
      httpParams = httpParams.set('category', params.category);
    if (params.search && params.search.trim() !== '')
      httpParams = httpParams.set('search', params.search.trim());

    return this.http.get<{
      success: boolean;
      logs: ActivityLogItem[];
      pagination: PaginationData;
    }>(`${environment.apiUrl}/admin/logs`, { params: httpParams });
  }

  // ดึงสรุปสถิติวันนี้
  getTodayStats(): Observable<{
    success: boolean;
    stats: TodayStats;
    recentLogs: ActivityLogItem[];
  }> {
    return this.http.get<{
      success: boolean;
      stats: TodayStats;
      recentLogs: ActivityLogItem[];
    }>(`${environment.apiUrl}/admin/logs/today-stats`);
  }

  // ล้างประวัติกิจกรรมที่เก่ากว่าจำนวนวันที่กำหนด (ค่าเริ่มต้น 365 วัน = 1 ปี)
  cleanupOldLogs(days: number = 365): Observable<{
    success: boolean;
    message: string;
    deletedCount?: number;
  }> {
    return this.http.post<{
      success: boolean;
      message: string;
      deletedCount?: number;
    }>(`${environment.apiUrl}/admin/logs/cleanup`, { days });
  }
}
