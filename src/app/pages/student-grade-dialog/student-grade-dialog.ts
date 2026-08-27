import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

export interface SubjectScoreDetail {
  name: string;
  code?: string;
  credit: number;
  rawScore?: number | null;
  maxScore?: number;
  percentage?: number | null;
  grade?: string;
  letterGrade?: string;
  gradePoint?: number;
  indexValue?: number | string | null;
  groupId?: number | string;
  rowspan?: number;
  isFirstInGroup?: boolean;
  is_su?: boolean;
}

export interface StudentGradeDialogData {
  student: {
    id: string;
    code: string;
    rank: string;
    name: string;
    subjects: SubjectScoreDetail[];
    totalCredit: number;
    gpa: string;
    isPassed: boolean;
    trainingTimeScore?: number;
    examTimeScore?: number;
    behaviorScore?: number;
  };
  courseName?: string;
  batchName?: string;
}

@Component({
  selector: 'app-student-grade-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule],
  templateUrl: './student-grade-dialog.html',
  styleUrl: './student-grade-dialog.scss'
})
export class StudentGradeDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<StudentGradeDialog>,
    @Inject(MAT_DIALOG_DATA) public data: StudentGradeDialogData
  ) {}

  ngOnInit(): void {
    if (this.data && this.data.student && this.data.student.subjects) {
      const groupCounts: { [key: string]: number } = {};
      this.data.student.subjects.forEach((sub, index) => {
        const gId = sub.groupId ? `group_${sub.groupId}` : `single_${index}`;
        groupCounts[gId] = (groupCounts[gId] || 0) + 1;
      });

      const groupSeen: { [key: string]: boolean } = {};
      this.data.student.subjects.forEach((sub, index) => {
        const gId = sub.groupId ? `group_${sub.groupId}` : `single_${index}`;
        if (!groupSeen[gId]) {
          sub.isFirstInGroup = true;
          sub.rowspan = groupCounts[gId];
          groupSeen[gId] = true;
        } else {
          sub.isFirstInGroup = false;
          sub.rowspan = 0;
        }
      });
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  printReport(): void {
    window.print();
  }

  getNumericGrade(grade: string | undefined): string | number {
    if (!grade || grade === '-') return '-';
    const g = grade.trim().toUpperCase();
    switch (g) {
      case 'A': return '4.0';
      case 'B+': return '3.5';
      case 'B': return '3.0';
      case 'C+': return '2.5';
      case 'C': return '2.0';
      case 'D+': return '1.5';
      case 'D': return '1.0';
      case 'F': return '0.0';
      default: return g; // For S, U, etc.
    }
  }

  get printFontSize(): string {
    const count = this.data.student.subjects?.length || 0;
    if (count >= 25) return '10px';
    if (count >= 20) return '11px';
    if (count >= 15) return '12px';
    if (count >= 10) return '13px';
    return '14px';
  }

  getGradeDescription(score: number | string): string {
    const numScore = Number(score);
    if (isNaN(numScore)) return "";
    if (numScore >= 3.5) return "ดีเลิศ";
    if (numScore >= 3.0) return "ดีมาก";
    if (numScore >= 2.5) return "ดี";
    if (numScore >= 2.0) return "พอใช้";
    return "";
  }
}
