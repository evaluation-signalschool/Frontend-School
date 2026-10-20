import { Component, Inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { ScoreService } from '../../services/score.service';
import { StudentService } from '../../services/student.service';
import Swal from 'sweetalert2';

export interface BehaviorScoreStudent {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  affiliation?: string;
  behaviorScore: number | null;
}

export interface BehaviorScoreDialogData {
  batchId: number | string;
  batchName?: string;
  courseName?: string;
}

@Component({
  selector: 'app-behavior-score-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatDialogModule],
  templateUrl: './behavior-score-dialog.html',
  styleUrl: './behavior-score-dialog.scss',
})
export class BehaviorScoreDialog implements OnInit {
  students: BehaviorScoreStudent[] = [];
  filteredStudents: BehaviorScoreStudent[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  isSaved: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<BehaviorScoreDialog>,
    @Inject(MAT_DIALOG_DATA) public data: BehaviorScoreDialogData,
    private scoreService: ScoreService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    if (this.data && this.data.batchId) {
      this.loadBatchStudents();
    }
  }

  loadBatchStudents(): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    const batchId = Number(this.data.batchId);

    this.scoreService.getBatchSummaryScores(batchId).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          const list = res?.data || (Array.isArray(res) ? res : []);
          if (list && list.length > 0) {
            this.students = list.map((st: any) => ({
              student_id: st.student_id || st.id,
              student_code: st.student_code || '',
              rank_name: st.rank_name || '',
              first_name: st.first_name || '',
              last_name: st.last_name || '',
              affiliation: st.affiliation || '',
              behaviorScore:
                st.behavior_score !== null && st.behavior_score !== undefined
                  ? Number(st.behavior_score)
                  : 200, // ค่าเริ่มต้นคะแนนความประพฤติเต็ม 200
            }));
            this.applyFilter();
          } else {
            this.fallbackLoadStudents(batchId);
          }
          this.cdr.detectChanges();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          console.warn('Error loading behavior scores, trying fallback:', err);
          this.fallbackLoadStudents(batchId);
          this.cdr.detectChanges();
        });
      },
    });
  }

  private fallbackLoadStudents(batchId: number): void {
    this.studentService.getStudents(String(batchId)).subscribe({
      next: (studentRes: any) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          const list = Array.isArray(studentRes) ? studentRes : (studentRes?.data || []);
          if (list && list.length > 0) {
            this.students = list.map((st: any) => ({
              student_id: st.id || st.student_id,
              student_code: st.student_code || '',
              rank_name: st.rank_name || '',
              first_name: st.first_name || '',
              last_name: st.last_name || '',
              affiliation: st.affiliation || '',
              behaviorScore: 200,
            }));
            this.applyFilter();
          } else {
            this.students = [];
            this.filteredStudents = [];
          }
          this.cdr.detectChanges();
        });
      },
      error: (stErr: any) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          console.error('Error loading fallback students for behavior score:', stErr);
          this.students = [];
          this.filteredStudents = [];
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'error',
            title: 'ผิดพลาด',
            text: 'ไม่สามารถดึงรายชื่อนักเรียนสำหรับกรอกคะแนนความประพฤติได้',
            confirmButtonColor: '#8e44ad',
          });
        });
      },
    });
  }

  applyFilter(): void {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredStudents = [...this.students];
    } else {
      this.filteredStudents = this.students.filter((st) => {
        const full = `${st.student_code} ${st.rank_name} ${st.first_name} ${st.last_name} ${st.affiliation}`.toLowerCase();
        return full.includes(q);
      });
    }
    this.cdr.detectChanges();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  quickFillAll(score: number): void {
    const validScore = Math.max(0, Math.min(200, score));
    this.students.forEach((st) => {
      st.behaviorScore = validScore;
    });
    this.applyFilter();
    this.cdr.detectChanges();
  }

  onWheel(event: WheelEvent): void {
    (event.target as HTMLElement)?.blur();
  }

  cleanScoreValue(rawStr: string, max: number = 200): { cleanedStr: string; numVal: number | null } {
    if (!rawStr || rawStr.trim() === '') {
      return { cleanedStr: '', numVal: null };
    }

    // 1. อนุญาตเฉพาะตัวเลข 0-9 และจุดทศนิยม .
    let cleaned = rawStr.replace(/[^0-9.]/g, '');

    // 2. ป้องกันจุดทศนิยมซ้ำ เช่น 1.2.3 -> ให้เหลือจุดเดียว
    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex !== -1) {
      const intPart = cleaned.substring(0, firstDotIndex);
      const decPart = cleaned.substring(firstDotIndex + 1).replace(/\./g, '');
      // จำกัดทศนิยมสูงสุดไม่เกิน 2 ตำแหน่ง
      cleaned = (intPart === '' ? '0' : intPart) + '.' + decPart.slice(0, 2);
    }

    // 3. จัดการเลข 0 นำหน้า (Leading Zeros) เช่น 0000000 -> 0, 05 -> 5, 00.5 -> 0.5
    if (cleaned.includes('.')) {
      let [intPart, decPart] = cleaned.split('.');
      if (intPart.length > 1 && intPart.startsWith('0')) {
        intPart = intPart.replace(/^0+(?=[0-9])/, '');
        if (intPart === '') intPart = '0';
      }
      cleaned = intPart + '.' + decPart;
    } else {
      if (cleaned.length > 1 && cleaned.startsWith('0')) {
        if (/^0+$/.test(cleaned)) {
          cleaned = '0';
        } else {
          cleaned = cleaned.replace(/^0+(?=[1-9])/, '');
        }
      }
    }

    // 4. ตรวจสอบและจำกัดไม่ให้เกินคะแนนเต็ม (max 200) หรือน้อยกว่า 0
    let numVal: number | null = null;
    if (cleaned !== '' && cleaned !== '.') {
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        if (parsed > max) {
          cleaned = max.toString();
          numVal = max;
        } else if (parsed < 0) {
          cleaned = '0';
          numVal = 0;
        } else {
          numVal = parsed;
        }
      }
    }

    return { cleanedStr: cleaned, numVal };
  }

  validateScore(student: BehaviorScoreStudent, max: number, event: any): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    const { cleanedStr, numVal } = this.cleanScoreValue(rawVal, max);

    input.value = cleanedStr;
    student.behaviorScore = numVal;
    this.cdr.detectChanges();
  }

  onScoreBlur(student: BehaviorScoreStudent, max: number, event: any): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    const { cleanedStr, numVal } = this.cleanScoreValue(rawVal, max);

    // หากปล่อยว่างไว้ ให้รีเซ็ตกลับเป็นค่าเริ่มต้น 200 คะแนน
    if (cleanedStr === '' || numVal === null) {
      input.value = '200';
      student.behaviorScore = 200;
    } else {
      // ป้องกันเลข 0 หลายตัว เช่น 00, 000 ให้แปลงเป็นเลข 0 เดี่ยวอย่างถูกต้อง
      const finalNum = Number(numVal);
      const formatted = isNaN(finalNum) ? '200' : finalNum.toString();
      input.value = formatted;
      student.behaviorScore = isNaN(finalNum) ? 200 : finalNum;
    }
    this.cdr.detectChanges();
  }

  saveScores(): void {
    if (this.isSaving) return;

    // ตรวจสอบความถูกต้องของคะแนนทุกคนก่อนบันทึก
    const hasInvalidScore = this.students.some(
      (st) =>
        st.behaviorScore !== null &&
        st.behaviorScore !== undefined &&
        (Number(st.behaviorScore) > 200 || Number(st.behaviorScore) < 0 || isNaN(Number(st.behaviorScore)))
    );

    if (hasInvalidScore) {
      Swal.fire({
        icon: 'warning',
        title: 'คะแนนเกินเกณฑ์ที่กำหนด',
        text: 'คะแนนความประพฤติต้องอยู่ระหว่าง 0 ถึง 200 คะแนนเท่านั้น กรุณาตรวจสอบและแก้ไขก่อนบันทึก',
        confirmButtonColor: '#8e44ad',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const payload = {
      batch_id: Number(this.data.batchId),
      scores: this.students.map((st) => ({
        student_id: st.student_id,
        behavior_score:
          st.behaviorScore !== null &&
          st.behaviorScore !== undefined &&
          st.behaviorScore.toString() !== ''
            ? Math.max(0, Math.min(200, Number(st.behaviorScore)))
            : 200,
      })),
    };

    this.scoreService
      .saveSpecialScoresBulk(payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.isSaved = true;
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ',
            text: `บันทึกคะแนนความประพฤตินักเรียนจำนวน ${this.students.length} นาย เรียบร้อยแล้ว`,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#8e44ad',
            timer: 2000,
            timerProgressBar: true,
          });
          this.dialogRef.close(true);
        },
        error: (err: any) => {
          console.error('Failed to save behavior scores', err);
          this.cdr.detectChanges();
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถบันทึกข้อมูลคะแนนความประพฤติได้ กรุณาลองใหม่อีกครั้ง',
            confirmButtonColor: '#d33',
          });
        },
      });
  }

  onClose(): void {
    this.dialogRef.close(false);
  }
}
