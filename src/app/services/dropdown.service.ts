import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // เช็ค path ให้ตรงกับโปรเจกต์ของคุณนะครับ
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class DropdownService {
  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  // สร้าง Headers แนบ Token ของแอดมินไปป้องกันความปลอดภัย
  private getAdminHeaders(): HttpHeaders {
    const token = this.authService.getAdminToken();
    const headersConfig: { [name: string]: string } = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headersConfig['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headersConfig);
  }

  // 1. ดึงหลักสูตรทั้งหมด
  getCourses(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/dropdown/courses`, {
      headers: this.getAdminHeaders(),
    });
  }

  // 2. ดึงรุ่น (ส่ง courseId ไปกรองได้)
  getBatches(courseId?: string | null): Observable<any> {
    const url =
      courseId && courseId !== 'all'
        ? `${environment.apiUrl}/dropdown/batches?course_id=${courseId}`
        : `${environment.apiUrl}/dropdown/batches`;

    return this.http.get<any>(url, {
      headers: this.getAdminHeaders(),
    });
  }

  // 3. ดึงวิชา (ต้องระบุรุ่น)
  getSubjects(batchId: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/dropdown/subjects?batch_id=${batchId}`, {
      headers: this.getAdminHeaders(),
    });
  }

  // 4. ดึงกลุ่มวิชา (ต้องระบุรุ่น)
  getSubjectGroups(batchId: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/dropdown/subject-groups?batch_id=${batchId}`, {
      headers: this.getAdminHeaders(),
    });
  }
}
