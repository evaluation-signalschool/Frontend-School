import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root', // กำหนดให้ Service นี้เรียกใช้ได้ทั้งแอปพลิเคชัน
})
export class StudentService {
  // กำหนด URL ของ Backend (แนะนำให้ย้ายไปไว้ใน environment.ts ในอนาคต)

  constructor(private http: HttpClient) {}

  // 1. ฟังก์ชันดึงข้อมูลนักเรียนทั้งหมด (GET) หรือตามรุ่น
  getStudents(batchId?: string): Observable<any> {
    const url = batchId
      ? `${environment.apiUrl}/students?batch_id=${batchId}`
      : `${environment.apiUrl}/students`;
    return this.http.get<any>(url);
  }

  // 2. ฟังก์ชันอัปโหลดไฟล์ CSV (POST)
  uploadStudentCsv(batch_id: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('batch_id', batch_id);
    formData.append('csvFile', file);

    // ส่ง FormData ไปที่ /api/students/upload
    return this.http.post<any>(`${environment.apiUrl}/students/upload`, formData);
  }

  // 3. ฟังก์ชันเพิ่มนักเรียนรายคน
  addStudent(studentData: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/students/add`, studentData);
  }

  // 4. ฟังก์ชันอัปเดตข้อมูลนักเรียนรายคน (PUT)
  updateStudent(id: number, studentData: any): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/students/${id}`, studentData);
  }

  // 4.1 ฟังก์ชันอัปเดตสังกัดของนักเรียนแบบกลุ่ม (สำหรับการเลือกลงหน่วย Unit Selection)
  updateBatchAffiliations(assignments: { student_id: number; affiliation: string }[]): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/students/batch/affiliations`, { assignments });
  }

  // 5. ฟังก์ชันลบข้อมูลนักเรียนรายคน (DELETE)
  deleteStudent(id: number): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/students/${id}`);
  }

  // 6. จัดเรียงเลขที่ใหม่ (PUT)
  resequenceStudents(batchId: string): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/students/resequence/${batchId}`, {});
  }

  // --- Profile Edit Requests ---

  submitProfileEditRequest(formData: FormData): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/edit-profile`, formData);
  }

  getProfileEditStatus(studentId: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/edit-profile/status/${studentId}`);
  }

  getProfileEditRequests(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/edit-profile/requests`);
  }

  updateProfileEditRequestStatus(id: number, status: 'approved' | 'rejected'): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/edit-profile/requests/${id}`, { status });
  }
}
