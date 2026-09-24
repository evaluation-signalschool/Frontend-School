import { Injectable } from "@angular/core";
import { environment } from '../../environments/environment';
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";


export interface Subject {
  subject_id: number;
  subject_name: string;
  form_url?: string;
}
export interface SubjectGroup {
  group_name: string;
  subjects: Subject[];
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  errorDetails?: string;
  data: SubjectGroup[];
}

@Injectable({
  providedIn: 'root',
})
export class SubjectService {

  constructor(private http: HttpClient) {}

  getSubjectsByBatch(batchId: number): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(
      `${environment.apiUrl}/subjects/${batchId}`
    );
  }
}