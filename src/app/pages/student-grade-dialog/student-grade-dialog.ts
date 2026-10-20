import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

export interface SubjectScoreDetail {
  id?: number | string;
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
  groupName?: string;
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

// ลำดับวิชามาตรฐานตามโครงสร้างหลักสูตร (M01..M07, MN08..MN09, S10, P11)
export const CANONICAL_SUBJECT_ORDER: { [name: string]: number } = {
  // M01
  'การส่งกำลังและซ่อมบำรุงสายสื่อสาร': 1,
  'การจัดหน่วยทหารสื่อสาร': 2,
  // M02
  'วงจรไฟฟ้า': 3,
  // M03
  'การสื่อสารทางยุทธวิธี': 4,
  // M04
  'การสื่อสารประเภทวิทยุและการสงครามอิเล็กทรอนิกส์': 5,
  // M05
  'การสื่อสารประเภทสาย': 6,
  // M06
  'ภาษาอังกฤษทางทหาร': 7,
  'การอำนวยการทางการสื่อสาร': 8,
  // M07
  'การพัฒนาทักษะดิจิทัลที่จำเป็นระดับต้น': 9,
  // MN01 / MN08
  'การรักษาความปลอดภัย': 10,
  'การป้องกันและปราบปรามการก่อความไม่สงบ': 11,
  'ระเบียบงานสารบรรณ': 12,
  // MN02 / MN09
  'แผนที่เข็มทิศ': 13,
  // S01 / S10
  'ผู้นำหน่วย': 14,
  'วิชาตามนโยบายที่กองทัพบกกำหนด': 15,
  // P01 / P11
  'ฝึกทบทวนการใช้เครื่องมือสื่อสาร': 16,
};

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
      const subjects = this.data.student.subjects;

      // 1. เรียงลำดับวิชาตามโครงสร้างหลักสูตรที่แท้จริง (Canonical Curriculum Order)
      subjects.sort((a, b) => {
        const aName = (a.name || '').trim();
        const bName = (b.name || '').trim();
        const orderA = CANONICAL_SUBJECT_ORDER[aName];
        const orderB = CANONICAL_SUBJECT_ORDER[bName];

        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;

        // กรณีวิชาอื่นที่ไม่ได้ระบุในรายการหลัก: จัดกลุ่มตาม groupId แล้วเรียงตามชื่อ
        if (a.groupId !== b.groupId) {
          return String(a.groupId || '').localeCompare(String(b.groupId || ''));
        }
        return aName.localeCompare(bName, 'th');
      });

      // 2. คำนวณ rowspan เฉพาะแถวที่อยู่ติดกันจริง (Contiguous blocks) เพื่อป้องกัน layout พัง
      let i = 0;
      while (i < subjects.length) {
        const curGroupId = subjects[i].groupId;
        let count = 1;

        if (curGroupId !== undefined && curGroupId !== null && curGroupId !== '') {
          while (i + count < subjects.length && subjects[i + count].groupId === curGroupId) {
            count++;
          }
        }

        subjects[i].isFirstInGroup = true;
        subjects[i].rowspan = count;

        for (let j = 1; j < count; j++) {
          subjects[i + j].isFirstInGroup = false;
          subjects[i + j].rowspan = 0;
        }

        i += count;
      }
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
    if (g === 'S' || g === 'U') return g;
    switch (g) {
      case 'A': return '4.00';
      case 'B+': return '3.50';
      case 'B': return '3.00';
      case 'C+': return '2.50';
      case 'C': return '2.00';
      case 'D+': return '1.50';
      case 'D': return '1.00';
      case 'F': return '0.00';
      default: {
        const num = parseFloat(g);
        if (!isNaN(num)) return num.toFixed(2);
        return g;
      }
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
