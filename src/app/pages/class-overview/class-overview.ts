import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { DropdownService } from '../../services/dropdown.service';
import { CourseService, CourseGroup } from '../../services/course.service';
import { ScoreService } from '../../services/score.service';
import { StudentGradeDialog, SubjectScoreDetail } from '../student-grade-dialog/student-grade-dialog';
import { SpecialScoreDialog } from '../special-score-dialog/special-score-dialog';
import Swal from 'sweetalert2';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface SubjectHeader {
  id: number;
  name: string;
  credit: number;
  groupId?: number | string;
  groupName?: string;
  max_score?: number;
  is_su?: boolean;
}

export interface SubjectGroupHeader {
  groupId: number | string;
  groupName: string;
  groupCode?: string;
  credit: number;
  subjects: SubjectHeader[];
  isSingle: boolean;
}

export interface StudentOverview {
  id: string;
  code: string;
  rank: string;
  name: string;
  subjects: SubjectScoreDetail[];
  totalCredit: number;
  totalScore?: number;
  gpa: string;
  isPassed: boolean;
  group_results?: { [key: string | number]: any };
  trainingTimeScore?: number;
  examTimeScore?: number;
  behaviorScore?: number;
}

@Component({
  selector: 'app-class-overview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatDialogModule,
    RouterModule
  ],
  templateUrl: './class-overview.html',
  styleUrl: './class-overview.scss'
})
export class ClassOverview implements OnInit {

  // Dropdown States (เงื่อนไขหลัก)
  courses: { id: any; group_name: string }[] = [];
  selectedCourse: any = '';

  batches: { id: any; name: string }[] = [];
  selectedBatch: any = '';

  // Data States
  courseGroups: CourseGroup[] = [];
  students: StudentOverview[] = [];
  masterSubjects: SubjectHeader[] = [];
  subjectGroups: SubjectGroupHeader[] = [];
  
  lastProcessedTime: string = '';
  isLoading: boolean = false;

  constructor(
    private courseService: CourseService,
    private dropdownService: DropdownService,
    private scoreService: ScoreService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCourses();
    this.updateProcessedTime();
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data;
          this.courses = res.data.map((cg: CourseGroup) => ({
            id: cg.batches?.[0]?.course_id || cg.course_name,
            group_name: cg.course_name
          }));
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Failed to load courses:', err);
        this.cdr.detectChanges();
      }
    });
  }

  onCourseChange(): void {
    this.selectedBatch = '';
    this.students = [];
    this.masterSubjects = [];
    this.batches = [];

    if (this.selectedCourse) {
      const courseGroup = this.courseGroups.find(
        (c) => c.batches?.[0]?.course_id == this.selectedCourse || c.course_name === this.selectedCourse
      );

      if (courseGroup && courseGroup.batches && courseGroup.batches.length > 0) {
        this.batches = courseGroup.batches.map((b) => ({
          id: b.batch_id,
          name: b.batch_name || `รุ่นที่ ${b.batch_id}`
        }));
      } else {
        this.dropdownService.getBatches(this.selectedCourse).subscribe({
          next: (res) => {
            if (res?.success && res.data) {
              this.batches = res.data.map((b: any) => ({
                id: b.id || b.batch_id,
                name: b.name || b.batch_name || `รุ่นที่ ${b.id || b.batch_id}`
              }));
              this.cdr.detectChanges();
            }
          },
          error: (err) => {
            console.error('Failed to load batches:', err);
            this.cdr.detectChanges();
          }
        });
      }
    }
  }

  onBatchChange(): void {
    if (!this.selectedBatch) {
      this.students = [];
      this.masterSubjects = [];
      return;
    }

    this.isLoading = true;
    const batchId = Number(this.selectedBatch);

    if (isNaN(batchId)) {
      console.error('Invalid batchId:', this.selectedBatch);
      this.isLoading = false;
      return;
    }

    this.scoreService.getBatchScoresSummary(batchId).subscribe({
      next: (res: any) => {
        if (res?.success) {
          // ใช้งานข้อมูลผลลัพธ์ที่คำนวณจาก Backend โดยตรง
          this.subjectGroups = res.summary.subjectGroups || [];
          this.masterSubjects = (res.summary.masterSubjects || []).map((sub: any) => {
            const group = this.subjectGroups.find(g => g.subjects.some((s: any) => s.id === sub.id));
            return {
              ...sub,
              credit: group ? group.credit : 0,
              groupId: group ? group.groupId : null
            };
          });
          
          const rawStudents = res.data || [];
          
          this.students = rawStudents.map((st: any) => {
            const mappedSubjects = this.masterSubjects.map(sub => {
              const rawScore = st.subject_scores ? st.subject_scores[sub.id] : null;
              
              // ดึงผลการเรียนรวมของกลุ่ม
              let gradeDisplay = '-';
              let indexValue: string | number = '0.00';
              let originalLetterGrade = '-';

              if (sub.groupId && st.group_results && st.group_results[sub.groupId]) {
                 const gResult = st.group_results[sub.groupId];
                 
                 // คำนวณหาเกรดตัวเลขจาก index_value / credit (สำหรับแสดงใน Tab 2)
                 if (sub.is_su || Number(sub.credit) === 0) {
                   gradeDisplay = gResult.grade;
                 } else {
                   const gp = Number(gResult.index_value) / Number(sub.credit);
                   gradeDisplay = !isNaN(gp) ? gp.toFixed(2) : gResult.grade;
                 }
                 indexValue = gResult.index_value;
                 originalLetterGrade = gResult.grade;
              }

              return {
                id: sub.id,
                name: sub.name,
                credit: sub.credit,
                maxScore: sub.max_score,
                rawScore: rawScore,
                grade: gradeDisplay,
                letterGrade: originalLetterGrade, // เก็บเกรดตัวอักษรไว้แสดงในหน้ารายงานเดี่ยว
                indexValue: indexValue,
                groupId: sub.groupId,
                is_su: sub.is_su
              };
            });

            const gpa = st.gpa || "0.00";

            return {
              ...st,
              id: st.student_id || st.id,
              code: st.student_code || st.code,
              name: st.full_name || st.name,
              gpa: gpa,
              isPassed: Number(gpa) >= 2.0,
              subjects: mappedSubjects,
              totalCredit: res.summary.total_credit || 0,
              totalScore: st.total_raw_score || 0,
              group_results: st.group_results || {},
              trainingTimeScore: st.training_time_score ?? st.trainingTimeScore ?? null,
              examTimeScore: st.exam_time_score ?? st.examTimeScore ?? null,
              behaviorScore: st.behavior_score ?? st.behaviorScore ?? null
            };
          });
          
          this.updateProcessedTime();
        } else {
          this.students = [];
          this.masterSubjects = [];
          this.subjectGroups = [];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error fetching batch scores summary from service:', err);
        this.students = [];
        this.masterSubjects = [];
        this.subjectGroups = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }



  getSingleSubjectScore(student: any, grp: any): any {
    if (!student || !grp) return null;
    
    let targetSubId = (grp.subjects && grp.subjects.length > 0) ? grp.subjects[0].id : null;
    if (targetSubId !== null && student.subjects && Array.isArray(student.subjects)) {
      const byId = student.subjects.find((s: any) => s.id === targetSubId);
      if (byId) return byId;
    }
    return null;
  }

  getGroupScore(student: any, grp: any): string {
    if (student.group_results && student.group_results[grp.groupId]) {
      const gResult = student.group_results[grp.groupId];
      return `${gResult.grade} (${gResult.index_value})`;
    }
    return '-';
  }

  getGroupColorCode(groupName: string, isSingle: boolean): string {
    const name = groupName ? groupName.trim().toUpperCase() : '';
    if (name.startsWith('MN')) return 'FFFFEBEE'; // Red/Pink (Minor)
    if (name.startsWith('M')) return 'FFFFF9C4';  // Yellow (Main)
    if (name.startsWith('S')) return 'FFE3F2FD';  // Blue (Supporting)
    if (name.startsWith('P')) return 'FFF5F5F5';  // White/Gray (Practical)
    // Fallback: หากไม่ได้ตั้งชื่อนำหน้าด้วยตัวย่อ ให้ใช้สีตามหน้าเว็บ (ชมพูสำหรับวิชาเดี่ยว, เขียวสำหรับวิชากลุ่ม)
    return isSingle ? 'FFFCE4EC' : 'FFE8F5E9';
  }

  getSubjectIndex(sub: SubjectHeader): number {
    return this.masterSubjects.findIndex(s => s.id === sub.id);
  }

  getSelectedCourseName(): string {
    const found = this.courses.find(c => String(c.id) === String(this.selectedCourse));
    return found ? found.group_name : '';
  }

  getSelectedBatchName(): string {
    const found = this.batches.find(b => String(b.id) === String(this.selectedBatch));
    return found ? found.name : '';
  }

  openStudentGradeModal(student: StudentOverview): void {
    this.dialog.open(StudentGradeDialog, {
      data: {
        student,
        courseName: this.getSelectedCourseName(),
        batchName: this.getSelectedBatchName()
      },
      width: '760px',
      maxWidth: '95vw',
      panelClass: 'custom-dialog-container'
    });
  }

  async exportToExcel(): Promise<void> {
    if (!this.students || this.students.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Master Grid');

    worksheet.properties.defaultRowHeight = 25;

    // 1. สร้าง Headers แถวที่ 1 (กลุ่มวิชา) และ แถวที่ 2 (วิชาย่อย)
    const headerRow1 = ['ลำดับที่', 'ยศ-ชื่อ-นามสกุล'];
    const headerRow2 = ['', ''];

    let colIndex = 3;
    const mergeCells: { s: string, e: string, color: string }[] = [];
    const colColors: { [col: number]: string } = {};

    if (this.subjectGroups.length > 0) {
      this.subjectGroups.forEach(grp => {
        const startCol = colIndex;
        const color = this.getGroupColorCode(grp.groupCode || grp.groupName, grp.isSingle);
        
        headerRow1.push(grp.groupName);
        for (let i = 1; i < grp.subjects.length; i++) {
           headerRow1.push(''); // ช่องว่างสำหรับ colspan
        }
        
        if (grp.subjects.length > 1) {
          mergeCells.push({ s: worksheet.getColumn(startCol).letter + '1', e: worksheet.getColumn(startCol + grp.subjects.length - 1).letter + '1', color: color });
        } else {
          mergeCells.push({ s: worksheet.getColumn(startCol).letter + '1', e: worksheet.getColumn(startCol).letter + '1', color: color });
        }
        
        grp.subjects.forEach(sub => {
           headerRow2.push(sub.name);
           colColors[colIndex] = color;
           colIndex++;
        });
      });
    } else {
      this.masterSubjects.forEach(sub => {
        headerRow1.push(sub.name);
        headerRow2.push('');
        colIndex++;
      });
    }

    const specialCols = ['ฝึกอบรม (100)', 'สอบ (100)', 'ความประพฤติ (200)', 'คะแนนรวม', 'GPA', 'สถานะ'];
    specialCols.forEach(col => {
      headerRow1.push(col);
      headerRow2.push('');
      mergeCells.push({ s: worksheet.getColumn(colIndex).letter + '1', e: worksheet.getColumn(colIndex).letter + '2', color: 'FFF0E6F7' });
      colIndex++;
    });

    const hr1 = worksheet.addRow(headerRow1);
    const hr2 = worksheet.addRow(headerRow2);

    // Style Headers
    hr1.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 12, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    hr2.eachCell((cell, colNumber) => {
      cell.font = { name: 'Sarabun', size: 11, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      if (colColors[colNumber]) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colColors[colNumber] } };
      }
    });

    mergeCells.forEach(merge => {
      worksheet.mergeCells(merge.s + ':' + merge.e);
      const cell = worksheet.getCell(merge.s);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: merge.color }
      };
    });
    
    worksheet.mergeCells('A1:A2');
    worksheet.mergeCells('B1:B2');
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAE0F5' } };
    worksheet.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAE0F5' } };

    // 2. ข้อมูลนักเรียน
    this.students.forEach((student, index) => {
      const row = [
        index + 1,
        (student.rank ? student.rank + ' ' : '') + (student.name || '')
      ];
      const fills: { col: number, color: string }[] = [];
      let cIdx = 3;

      if (this.subjectGroups.length > 0) {
         this.subjectGroups.forEach(grp => {
           const result = student.group_results?.[grp.groupId];
           if (grp.isSingle) {
              if (result) {
                 row.push(this.getNumericGradeDisplay(result.grade, result.index_value, grp.credit) + ` (${result.index_value})`);
              } else {
                 row.push('-');
                 fills.push({ col: cIdx, color: 'FFFFF9C4' }); // สีเหลืองอ่อน ถ้ารอคะแนน
              }
              cIdx++;
           } else {
              grp.subjects.forEach(sub => {
                 const subResult = student.subjects?.find(s => (s as any).id === sub.id || s.name === sub.name);
                 if (subResult) {
                    const gradeInfo = this.formatGradeWithIndex(subResult);
                    row.push(gradeInfo.gradeDisplay + (gradeInfo.indexDisplay ? ` ${gradeInfo.indexDisplay}` : ''));
                 } else {
                    row.push('-');
                    fills.push({ col: cIdx, color: 'FFFFF9C4' }); // สีเหลืองอ่อน ถ้ารอคะแนน
                 }
                 cIdx++;
              });
           }
         });
      } else {
         this.masterSubjects.forEach(sub => {
            const subResult = student.subjects?.find(s => (s as any).id === sub.id || s.name === sub.name);
            if (subResult) {
               const gradeInfo = this.formatGradeWithIndex(subResult);
               row.push(gradeInfo.gradeDisplay + (gradeInfo.indexDisplay ? ` ${gradeInfo.indexDisplay}` : ''));
            } else {
               row.push('-');
               fills.push({ col: cIdx, color: 'FFFFF9C4' }); // สีเหลืองอ่อน ถ้ารอคะแนน
            }
            cIdx++;
         });
      }

      row.push(
        student.trainingTimeScore !== null && student.trainingTimeScore !== undefined ? student.trainingTimeScore : '-',
        student.examTimeScore !== null && student.examTimeScore !== undefined ? student.examTimeScore : '-',
        student.behaviorScore !== null && student.behaviorScore !== undefined ? student.behaviorScore : '-',
        student.totalScore !== undefined && student.totalScore !== null ? student.totalScore : '-',
        student.gpa || '0.00',
        student.isPassed ? 'ผ่าน' : 'ไม่ผ่าน'
      );

      const r = worksheet.addRow(row);
      r.eachCell((cell, colNumber) => {
        cell.font = { name: 'Sarabun', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'left' : 'center' };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
      
      fills.forEach(f => {
        r.getCell(f.col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f.color } };
      });
    });

    // กำหนดความกว้างคอลัมน์
    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 30;
    for (let i = 3; i <= colIndex; i++) {
       worksheet.getColumn(i).width = 15;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const batchName = this.getSelectedBatchName() || 'รุ่น';
    const filename = `MasterGrid_${batchName}.xlsx`.replace(/\s+/g, '_');
    
    saveAs(new Blob([buffer]), filename);
  }

  reProcess(): void {
    this.updateProcessedTime();
    if (this.selectedBatch) {
      this.onBatchChange();
    }
    Swal.fire({
      icon: 'success',
      title: 'สำเร็จ',
      text: 'ระบบทำการประมวลผลและดึงข้อมูลใหม่เรียบร้อยแล้ว!',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#8e44ad',
      background: '#ffffff',
      backdrop: `rgba(0,0,0,0.4)`
    });
  }

  formatGradeWithIndex(sub: SubjectScoreDetail): { gradeDisplay: string; indexDisplay: string; isSU: boolean } {
    if (!sub) {
      return { gradeDisplay: '-', indexDisplay: '', isSU: false };
    }

    const gStr = sub.grade ? String(sub.grade).trim() : '';
    const upperG = gStr.toUpperCase();

    if (upperG === 'S' || upperG === 'U' || upperG === 'P' || upperG === 'F') {
      return {
        gradeDisplay: gStr,
        indexDisplay: '',
        isSU: true
      };
    }

    return {
      gradeDisplay: gStr || (sub.rawScore !== undefined && sub.rawScore !== null ? String(sub.rawScore) : '-'),
      indexDisplay: sub.indexValue && sub.indexValue !== '0.00' ? `(${sub.indexValue})` : '',
      isSU: false
    };
  }

  getNumericGradeDisplay(grade: string, indexValue: number | string, credit: number): string {
    const gStr = grade ? String(grade).trim().toUpperCase() : '';
    if (['A', 'B+', 'B', 'C+', 'C', 'D+', 'D'].includes(gStr)) {
      const gp = Number(indexValue) / Number(credit);
      return !isNaN(gp) ? gp.toFixed(2) : gStr;
    }
    return gStr;
  }

  private updateProcessedTime(): void {
    const now = new Date();
    this.lastProcessedTime = now.toLocaleDateString('th-TH') + ' เวลา ' + now.toLocaleTimeString('th-TH') + ' น.';
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

  openSpecialScoreModal(): void {
    if (!this.selectedBatch) {
      alert('กรุณาเลือกรุ่นก่อนบันทึกคะแนนพิเศษ');
      return;
    }
    
    const dialogRef = this.dialog.open(SpecialScoreDialog, {
      data: {
        batchId: this.selectedBatch,
        students: this.students.map(st => ({
          id: st.id,
          code: st.code,
          name: st.name,
          rank: st.rank,
          trainingTimeScore: st.trainingTimeScore,
          examTimeScore: st.examTimeScore,
          behaviorScore: st.behaviorScore
        }))
      },
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'custom-dialog-container',
      disableClose: true 
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // หากบันทึกสำเร็จ ให้รีเฟรชข้อมูล (เรียกใช้งานฟังก์ชันดึงข้อมูลเดิม)
        this.reProcess();
      }
    });
  }
}