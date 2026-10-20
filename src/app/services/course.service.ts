import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BatchItem {
  course_id: number;
  curriculum_year: number;
  batch_id: number;
  batch_name: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

export interface CourseGroup {
  course_name: string;
  batches: BatchItem[];
}

export interface ApiResponse {
  success: boolean;
  data: CourseGroup[];
}

@Injectable({
  providedIn: 'root',
})
export class CourseService {
  private apiUrl = `${environment.apiUrl}/courses`;

  // แคชข้อมูลในหน่วยความจำ เพื่อให้การสลับหน้าในระบบผู้ดูแลโหลดข้อมูลได้ทันที
  private cachedCourses$: Observable<ApiResponse> | null = null;
  private cachedAllCourses$: Observable<any> | null = null;
  private cachedAllBatches$: Observable<any> | null = null;
  private cachedAllSubjectGroups$: Observable<any> | null = null;

  constructor(private http: HttpClient) {}

  clearCache(): void {
    this.cachedCourses$ = null;
    this.cachedAllCourses$ = null;
    this.cachedAllBatches$ = null;
    this.cachedAllSubjectGroups$ = null;
  }

  getCourses(forceRefresh = false): Observable<ApiResponse> {
    if (!this.cachedCourses$ || forceRefresh) {
      this.cachedCourses$ = this.http.get<ApiResponse>(this.apiUrl).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.cachedCourses$;
  }

  getTrainingSummary(courseId?: number, courseName?: string): Observable<any> {
    const queryParts: string[] = [];
    if (courseName) {
      queryParts.push(`courseName=${encodeURIComponent(courseName)}`);
    }
    if (courseId) {
      queryParts.push(`courseId=${courseId}`);
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return this.http.get<any>(`${environment.apiUrl}/training-summary${queryString}`);
  }

  generateAiSummary(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/training-summary/ai-generate`, payload).pipe(
      timeout(12000)
    );
  }

  saveTrainingSummary(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/training-summary/save-summary`, payload);
  }

  getSavedTrainingSummary(courseName: string, cohortKey: string): Observable<any> {
    const query = `courseName=${encodeURIComponent(courseName)}&cohortKey=${encodeURIComponent(cohortKey)}`;
    return this.http.get<any>(`${environment.apiUrl}/training-summary/get-summary?${query}`);
  }

  getSubjectsByBatch(batchId: string | number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/subjects/${batchId}`);
  }

  getAllCourses(forceRefresh = false): Observable<any> {
    if (!this.cachedAllCourses$ || forceRefresh) {
      this.cachedAllCourses$ = this.http.get<any>(`${environment.apiUrl}/courses/all`).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.cachedAllCourses$;
  }

  getAllBatches(forceRefresh = false): Observable<any> {
    if (!this.cachedAllBatches$ || forceRefresh) {
      this.cachedAllBatches$ = this.http.get<any>(`${environment.apiUrl}/batches/all`).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.cachedAllBatches$;
  }

  getAllSubjectGroups(forceRefresh = false): Observable<any> {
    if (!this.cachedAllSubjectGroups$ || forceRefresh) {
      this.cachedAllSubjectGroups$ = this.http.get<any>(`${environment.apiUrl}/subject-groups/all`).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.cachedAllSubjectGroups$;
  }

  addCourse(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/courses`, data).pipe(
      tap(() => this.clearCache())
    );
  }

  addBatch(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/batches`, data).pipe(
      tap(() => this.clearCache())
    );
  }

  updateBatch(id: number | string, data: any): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/batches/${id}`, data).pipe(
      tap(() => this.clearCache())
    );
  }

  toggleBatchActive(id: number | string, is_active: boolean): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/batches/${id}/toggle-active`, { is_active }).pipe(
      tap(() => this.clearCache())
    );
  }

  deleteBatch(id: number | string): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/batches/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  deleteCourse(id: number | string): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/courses/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  addSubjectGroup(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/subject-groups`, data).pipe(
      tap(() => this.clearCache())
    );
  }

  addSubject(data: any): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/subjects`, data);
  }

  checkGroupScores(id: number | string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/subject-groups/${id}/check-scores`);
  }

  deleteSubjectGroup(id: number | string): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/subject-groups/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  checkSubjectScores(id: number | string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/subjects/${id}/check-scores`);
  }

  deleteSubject(id: number | string): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/subjects/${id}`);
  }
}
