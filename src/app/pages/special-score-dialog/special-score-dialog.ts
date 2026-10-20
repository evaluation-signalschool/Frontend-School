import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ScoreService } from '../../services/score.service';
import Swal from 'sweetalert2';

export interface SpecialScoreStudent {
  id: number | string;
  code: string;
  name: string;
  rank: string;
  trainingTimeScore: number | null;
  examTimeScore: number | null;
  behaviorScore: number | null;
}

export interface SpecialScoreDialogData {
  batchId: number | string;
  students: SpecialScoreStudent[];
}

@Component({
  selector: 'app-special-score-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatDialogModule],
  templateUrl: './special-score-dialog.html',
  styleUrl: './special-score-dialog.scss'
})
export class SpecialScoreDialog implements OnInit {
  
  students: SpecialScoreStudent[] = [];
  isSaving = false;

  constructor(
    public dialogRef: MatDialogRef<SpecialScoreDialog>,
    @Inject(MAT_DIALOG_DATA) public data: SpecialScoreDialogData,
    private scoreService: ScoreService
  ) {}

  ngOnInit(): void {
    if (this.data && this.data.students) {
      // Deep clone to avoid mutating original data before saving
      this.students = JSON.parse(JSON.stringify(this.data.students));
      
      // กำหนดค่าเริ่มต้นให้เป็นคะแนนเต็ม หากยังไม่มีการกรอกคะแนน (เป็น 0 หรือ null)
      this.students.forEach(st => {
        if (!st.trainingTimeScore) {
          st.trainingTimeScore = 100;
        }
        if (!st.examTimeScore) {
          st.examTimeScore = 100;
        }
        if (!st.behaviorScore) {
          st.behaviorScore = 200;
        }
      });
    }
  }

  onClose(): void {
    this.dialogRef.close(false);
  }

  cleanScoreValue(rawStr: string, max: number): { cleanedStr: string; numVal: number | null } {
    if (!rawStr || rawStr.trim() === '') {
      return { cleanedStr: '', numVal: null };
    }

    let cleaned = rawStr.replace(/[^0-9.]/g, '');

    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex !== -1) {
      const intPart = cleaned.substring(0, firstDotIndex);
      const decPart = cleaned.substring(firstDotIndex + 1).replace(/\./g, '');
      cleaned = (intPart === '' ? '0' : intPart) + '.' + decPart.slice(0, 2);
    }

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

  validateScore(student: SpecialScoreStudent, field: 'trainingTimeScore' | 'examTimeScore' | 'behaviorScore', max: number, event: any): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    const { cleanedStr, numVal } = this.cleanScoreValue(rawVal, max);

    input.value = cleanedStr;
    student[field] = numVal;
  }

  saveScores(): void {
    const hasEmptyTime = this.students.some(st => 
      st.trainingTimeScore === null || st.trainingTimeScore === undefined || String(st.trainingTimeScore).trim() === '' ||
      st.examTimeScore === null || st.examTimeScore === undefined || String(st.examTimeScore).trim() === ''
    );

    if (hasEmptyTime) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกเปอร์เซ็นต์เวลาให้ครบถ้วน',
        text: 'กรุณากรอกเปอร์เซ็นต์เวลาให้ครบถ้วน',
        confirmButtonColor: '#8e44ad',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    const hasOverTime = this.students.some(st => 
      Number(st.trainingTimeScore) > 100 || Number(st.examTimeScore) > 100
    );
    if (hasOverTime) {
      Swal.fire({
        icon: 'warning',
        title: 'เปอร์เซ็นต์เวลาต้องไม่เกิน 100%',
        text: 'เปอร์เซ็นต์เวลาต้องไม่เกิน 100%',
        confirmButtonColor: '#8e44ad',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    const hasNegative = this.students.some(st => 
      Number(st.trainingTimeScore) < 0 || Number(st.examTimeScore) < 0 || isNaN(Number(st.trainingTimeScore)) || isNaN(Number(st.examTimeScore))
    );
    if (hasNegative) {
      Swal.fire({
        icon: 'warning',
        title: 'รูปแบบตัวเลขไม่ถูกต้อง',
        text: 'รูปแบบตัวเลขไม่ถูกต้อง',
        confirmButtonColor: '#8e44ad',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    const hasInvalidBehavior = this.students.some(st => 
      st.behaviorScore !== null && st.behaviorScore !== undefined && String(st.behaviorScore).trim() !== '' &&
      (Number(st.behaviorScore) > 200 || Number(st.behaviorScore) < 0 || isNaN(Number(st.behaviorScore)))
    );

    if (hasInvalidBehavior) {
      Swal.fire({
        icon: 'warning',
        title: 'คะแนนความประพฤติไม่ถูกต้อง',
        text: 'คะแนนความประพฤติต้องอยู่ระหว่าง 0 ถึง 200 คะแนน',
        confirmButtonColor: '#8e44ad',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    this.isSaving = true;
    
    const payload = {
      batch_id: this.data.batchId,
      scores: this.students.map(st => ({
        student_id: st.id,
        training_time_score: Number(st.trainingTimeScore),
        exam_time_score: Number(st.examTimeScore),
        behavior_score: (st.behaviorScore !== null && st.behaviorScore !== undefined && st.behaviorScore.toString() !== "") ? Number(st.behaviorScore) : null
      }))
    };

    this.scoreService.saveSpecialScoresBulk(payload).subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: 'สำเร็จ',
          text: 'บันทึกข้อมูลคะแนนพิเศษสำเร็จ!',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#8e44ad',
          background: '#ffffff',
          backdrop: `rgba(0,0,0,0.4)`
        });
        this.isSaving = false;
        this.dialogRef.close(true); // pass true to indicate successful save
      },
      error: (err: any) => {
        console.error('Failed to save special scores', err);
        const errMsg = err.error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        Swal.fire({
          icon: 'error',
          title: 'ผิดพลาด',
          text: errMsg,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#d33'
        });
        this.isSaving = false;
      }
    });
  }
}
