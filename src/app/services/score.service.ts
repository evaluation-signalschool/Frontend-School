import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// ==========================================
// Interfaces สำหรับผลการเรียน (Scores & Grades)
// ==========================================
export interface SubjectDetail {
  group_name: string;
  subject_id: number;
  subject_name: string;
  max_score: string;
  raw_score: string;
  is_evaluated?: boolean; // เพิ่มสถานะการประเมิน
}

export interface GroupSummary {
  group_name: string;
  credits: string;
  group_max_score: string;
  group_raw_score: string;
  group_percentage: string;
}

export interface ScoreResponse {
  message: string;
  student_id: string | number;
  batch_id?: string | number;
  subject_details: SubjectDetail[];
  group_summaries: GroupSummary[];
}

export interface UpdateMaxScoreRequest {
  batch_id: number;
  subject_id: number;
  max_score: number;
  is_su?: boolean;
}

export interface AdminStudentScore {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  raw_score: number | null;
}

export interface AdminSubjectScoresResponse {
  success: boolean;
  max_score: number;
  is_su?: boolean;
  data: AdminStudentScore[];
}

@Injectable({
  providedIn: 'root',
})
export class ScoreService {
  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  // ==========================================
  // Helper Methods สำหรับจัดการ Headers
  // ==========================================
  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  // ✅ สร้าง Helper สำหรับ Admin Token โดยเฉพาะ เพื่อลดความซ้ำซ้อน
  private getAdminHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  // ==========================================
  // API Methods
  // ==========================================

  // 2. ดึงข้อมูลคะแนนนักเรียน
  getStudentScores(studentId: number, batchId: number): Observable<ScoreResponse> {
    return this.http.get<ScoreResponse>(
      `${environment.apiUrl}/students/${studentId}/scores?batch_id=${batchId}`,
      { headers: this.getHeaders() },
    );
  }

  // 3. แอดมินดึงรายชื่อนักเรียนพร้อมคะแนนของวิชาที่เลือก (ทั้งห้อง)
  getAdminSubjectScores(
    batchId: number,
    subjectId: number,
  ): Observable<AdminSubjectScoresResponse> {
    return this.http
      .get<AdminSubjectScoresResponse>(
        `${environment.apiUrl}/admin/scores?batch_id=${batchId}&subject_id=${subjectId}`,
        { headers: this.getAdminHeaders() }, // ✅ ใช้ Helper Method
      )
      .pipe(
        // ✅ ดักจับ Error 404 แล้วคืนค่าข้อมูลว่างกลับไปแทน (แก้ปัญหาหน้าเว็บพังครั้งแรก)
        catchError((error) => {
          if (error.status === 404) {
            return of({ success: true, max_score: 0, data: [] } as AdminSubjectScoresResponse);
          }
          return throwError(() => error);
        }),
      );
  }

  // 5. อัปเดตคะแนนเต็มรายวิชา (แอดมิน)
  updateMaxScore(payload: UpdateMaxScoreRequest): Observable<any> {
    return this.http.put<any>(
      `${environment.apiUrl}/settings/max-score`,
      payload,
      { headers: this.getAdminHeaders() },
    );
  }


  // 6. บันทึกคะแนนแบบ Bulk (แอดมิน - ทั้งห้อง)
  saveAdminBulkScores(payload: {
    batch_id: number;
    subject_id: number;
    scores: { student_id: number; raw_score: number | null }[];
  }): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/admin/scores/bulk`,
      payload,
      { headers: this.getAdminHeaders() }, // ✅ ปรับมาใช้ Admin Header
    );
  }

  // 7. ประมวลผลคะแนนตามกลุ่มวิชา
  getProcessGroupScores(batchId: number, groupId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.apiUrl}/score/process-group?batch_id=${batchId}&group_id=${groupId}`,
      { headers: this.getAdminHeaders() }, // ✅ ปรับมาใช้ Admin Header
    );
  }

  // ฟังก์ชันดึงข้อมูลสรุปผลการเรียนทั้งรุ่น
  getBatchScoresSummary(batchId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.apiUrl}/score/process-batch?batch_id=${batchId}`,
      { headers: this.getAdminHeaders() }, // ✅ ปรับมาใช้ Admin Header
    );
  }

  // 8. บันทึกคะแนนพิเศษแบบ Bulk (ฝึกอบรม, สอบ, ความประพฤติ)
  saveSpecialScoresBulk(payload: any): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/scores/special-bulk`,
      payload,
      { headers: this.getAdminHeaders() },
    );
  }

  // ==========================================
  // Score Submissions (ตรวจสอบสถานะส่งคะแนน)
  // ==========================================
  getScoreSubmissions(batchId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.apiUrl}/score-submissions?batch_id=${batchId}`,
      { headers: this.getAdminHeaders() }
    );
  }

  saveScoreSubmissions(payload: { batch_id: number; submissions: any[] }): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/score-submissions/save`,
      payload,
      { headers: this.getAdminHeaders() }
    );
  }

  // ==========================================
  // จัดอันดับนักเรียนระดับรุ่น (พร้อมตรวจสอบความสมบูรณ์และแก้ปัญหาคะแนนเท่ากัน)
  // ==========================================
  getBatchRanking(batchId: number, subjectIds?: number[]): Observable<any> {
    const payload: any = { batch_id: batchId };
    if (subjectIds !== undefined) {
      payload.subject_ids = subjectIds;
    }
    return this.http.post<any>(
      `${environment.apiUrl}/score/ranking`,
      payload,
      { headers: this.getAdminHeaders() }
    );
  }
}
