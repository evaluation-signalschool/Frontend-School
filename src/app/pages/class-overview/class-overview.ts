import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { DropdownService } from '../../services/dropdown.service';
import { CourseService, CourseGroup } from '../../services/course.service';
import { ScoreService } from '../../services/score.service';
import { StudentGradeDialog, SubjectScoreDetail, CANONICAL_SUBJECT_ORDER } from '../student-grade-dialog/student-grade-dialog';
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
  cleanSubjectName?: string;
  is_su?: boolean;
  code?: string;
  type?: string;
  typeLabel?: string;
  creditsText?: string;
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

function getGroupPrefixOrder(name: string): number {
  const upper = (name || '').trim().toUpperCase();
  if (upper.startsWith('MN') || upper.includes('รอง')) return 2;
  if (upper.startsWith('M') || upper.includes('หลัก')) return 1;
  if (upper.startsWith('S') || upper.includes('ประกอบ')) return 3;
  if (upper.startsWith('P') || upper.includes('ปฏิบัติ')) return 4;
  return 5;
}

function compareGroupNames(aName: string, bName: string): number {
  const a = (aName || '').trim();
  const b = (bName || '').trim();
  const orderA = getGroupPrefixOrder(a);
  const orderB = getGroupPrefixOrder(b);
  if (orderA !== orderB) return orderA - orderB;
  const matchA = a.match(/\d+/);
  const matchB = b.match(/\d+/);
  if (matchA && matchB) {
    const numA = parseInt(matchA[0], 10);
    const numB = parseInt(matchB[0], 10);
    if (numA !== numB) return numA - numB;
  }
  return a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' });
}

function compareSubjectsInGroup(a: any, b: any): number {
  const aName = (a.name || a.subject_name || '').trim();
  const bName = (b.name || b.subject_name || '').trim();
  const orderA = CANONICAL_SUBJECT_ORDER[aName] ?? 999;
  const orderB = CANONICAL_SUBJECT_ORDER[bName] ?? 999;
  if (orderA !== orderB) return orderA - orderB;
  return (a.id || a.subject_id || 0) - (b.id || b.subject_id || 0);
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
  selectedTabIndex: number = 0; // รักษาแท็บที่เลือกไว้เมื่อสลับรุ่น

  // Data States
  courseGroups: CourseGroup[] = [];
  students: StudentOverview[] = [];
  masterSubjects: SubjectHeader[] = [];
  subjectGroups: SubjectGroupHeader[] = [];
  hasMultiSubjectGroups: boolean = false;
  
  lastProcessedTime: string = '';
  isLoading: boolean = false;

  // Cache ข้อมูลแต่ละรุ่นเพื่อการสลับรุ่นที่เร็วระดับเสี้ยววินาที (0ms)
  private batchCache = new Map<number, any>();

  constructor(
    private courseService: CourseService,
    private dropdownService: DropdownService,
    private scoreService: ScoreService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private location: Location,
    private router: Router
  ) {}

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/admin']);
    }
  }

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
          // เลือกหลักสูตรแรกให้อัตโนมัติทันที
          if (this.courses.length > 0 && !this.selectedCourse) {
            this.selectedCourse = this.courses[0].id;
            this.onCourseChange();
          }
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
        // เลือกรุ่นแรกโดยอัตโนมัติทันที
        if (this.batches.length > 0) {
          this.selectedBatch = this.batches[0].id;
          this.onBatchChange();
        }
        this.cdr.detectChanges();
      } else {
        this.dropdownService.getBatches(this.selectedCourse).subscribe({
          next: (res) => {
            if (res?.success && res.data) {
              this.batches = res.data.map((b: any) => ({
                id: b.id || b.batch_id,
                name: b.name || b.batch_name || `รุ่นที่ ${b.id || b.batch_id}`
              }));
              if (this.batches.length > 0) {
                this.selectedBatch = this.batches[0].id;
                this.onBatchChange();
              }
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
      this.subjectGroups = [];
      return;
    }

    const batchId = Number(this.selectedBatch);
    if (isNaN(batchId)) {
      console.error('Invalid batchId:', this.selectedBatch);
      this.isLoading = false;
      return;
    }

    // 1. ถ้ามีข้อมูลใน Cache อยู่แล้ว โหลดทันที 0ms ไม่ต้องรออินเทอร์เน็ต
    if (this.batchCache.has(batchId)) {
      const cached = this.batchCache.get(batchId);
      this.processBatchData(cached);
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.scoreService.getBatchScoresSummary(batchId).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          if (res?.success) {
            this.batchCache.set(batchId, res);
            this.processBatchData(res);
          } else {
            this.students = [];
            this.masterSubjects = [];
            this.subjectGroups = [];
            this.isLoading = false;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          }
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          console.error('Error fetching batch scores summary from service:', err);
          this.students = [];
          this.masterSubjects = [];
          this.subjectGroups = [];
          this.isLoading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  processBatchData(res: any): void {
    // จัดเรียงกลุ่มวิชาและวิชาย่อยตามลำดับหลักสูตรที่แท้จริง
    this.subjectGroups = (res.summary.subjectGroups || []).sort((a: any, b: any) => {
      return compareGroupNames(a.groupCode || a.groupName, b.groupCode || b.groupName);
    });

    this.subjectGroups.forEach((grp: any) => {
      if (grp.subjects && Array.isArray(grp.subjects)) {
        grp.subjects.sort(compareSubjectsInGroup);
      }
      grp.isSingle = !grp.subjects || grp.subjects.length <= 1;
      grp.groupCode = (grp.groupCode || grp.group_name || grp.groupName || '').trim();
      if (grp.isSingle) {
        const raw = grp.subjects?.[0]?.name || grp.groupName || '';
        grp.cleanSubjectName = raw.replace(/\s+\d+(\.\d+)?\s*นก\.?$/i, '').trim();
      } else {
        const raw = grp.groupCode || grp.groupName || '';
        grp.cleanSubjectName = raw.replace(/\s+\d+(\.\d+)?\s*นก\.?$/i, '').trim() || `กลุ่มวิชา (${grp.subjects?.length} วิชา)`;
      }

      // Pre-compute ข้อมูลของกลุ่มวิชาสำหรับ Template เพื่อความรวดเร็วระดับ 60 FPS
      grp.code = this.getGroupCode(grp);
      grp.type = this.getGroupType(grp.code);
      grp.creditsText = this.getGroupCreditsText(grp);
      grp.typeLabel = this.getGroupTypeLabel(grp.code);
    });

    this.hasMultiSubjectGroups = this.subjectGroups.some(g => g.subjects && g.subjects.length > 1);

    // สร้าง masterSubjects ตามลำดับ subjectGroups
    const flatMaster: any[] = [];
    this.subjectGroups.forEach((grp: any) => {
      (grp.subjects || []).forEach((sub: any) => {
        flatMaster.push({
          ...sub,
          credit: grp.credit || 0,
          groupId: grp.groupId,
          groupName: grp.groupCode || grp.groupName
        });
      });
    });

    this.masterSubjects = flatMaster.length > 0 ? flatMaster : (res.summary.masterSubjects || []).map((sub: any) => {
      const group = this.subjectGroups.find(g => g.subjects.some((s: any) => s.id === sub.id));
      return {
        ...sub,
        credit: group ? group.credit : 0,
        groupId: group ? group.groupId : null,
        groupName: group ? (group.groupCode || group.groupName) : ''
      };
    });
    
    const rawStudents = res.data || [];
    
    this.students = rawStudents.map((st: any) => {
      const mappedSubjects = this.masterSubjects.map(sub => {
        const rawScore = st.subject_scores ? st.subject_scores[sub.id] : null;
        let gradeDisplay = '-';
        let indexValue: string | number = '0.00';
        let originalLetterGrade = '-';

        if (sub.groupId && st.group_results && st.group_results[sub.groupId]) {
           const gResult = st.group_results[sub.groupId];
           if (sub.is_su || Number(sub.credit) === 0) {
             gradeDisplay = gResult.grade;
           } else {
             const gp = Number(gResult.index_value) / Number(sub.credit);
             const safeGp = !isNaN(gp) ? Math.min(4.0, Math.max(0, gp)) : null;
             gradeDisplay = safeGp !== null ? safeGp.toFixed(2) : gResult.grade;
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
          letterGrade: originalLetterGrade,
          indexValue: indexValue,
          groupId: sub.groupId,
          groupName: sub.groupName,
          is_su: sub.is_su
        };
      });

      // Pre-compute group_results ไว้ล่วงหน้า
      const processedGroupResults: { [key: string]: any } = {};
      if (st.group_results) {
        Object.keys(st.group_results).forEach((gId) => {
          const gResult = st.group_results[gId];
          const grp = this.subjectGroups.find(g => String(g.groupId) === String(gId));
          const cr = grp?.credit || 0;
          const numDisplay = this.getNumericGradeDisplay(gResult.grade, gResult.index_value, cr);
          const title = (grp?.isSingle && grp?.subjects?.[0]?.name)
            ? grp.subjects[0].name
            : `${grp?.code || ''} ${grp?.cleanSubjectName || ''}`;

          processedGroupResults[gId] = {
            ...gResult,
            numericDisplay: numDisplay,
            badgeClass: this.getGradeBadgeClass(gResult.grade, gResult.index_value, cr),
            tooltip: this.getGradeTooltip(gResult.grade, gResult.index_value, cr, title)
          };
        });
      }

      const numGpa = Number(st.gpa);
      const gpa = !isNaN(numGpa) ? Math.min(4.0, Math.max(0, numGpa)).toFixed(2) : "0.00";

      return {
        ...st,
        id: st.student_id || st.id,
        code: st.student_code || st.code,
        name: st.full_name || st.name,
        gpa: gpa,
        isPassed: Number(gpa) >= 2.0,
        subjects: mappedSubjects,
        totalCredit: res.summary.total_credit || 0,
        totalScore:
          st.total_raw_score !== null && st.total_raw_score !== undefined
            ? Number(Number(st.total_raw_score).toFixed(4))
            : 0,
        group_results: processedGroupResults,
        trainingTimeScore: st.training_time_score ?? st.trainingTimeScore ?? null,
        examTimeScore: st.exam_time_score ?? st.examTimeScore ?? null,
        behaviorScore: st.behavior_score ?? st.behaviorScore ?? null
      };
    });
    
    this.updateProcessedTime();
    this.isLoading = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
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

  get totalSubjectColumnsCount(): number {
    if (this.subjectGroups && this.subjectGroups.length > 0) {
      return this.subjectGroups.reduce((acc, grp) => acc + (grp.subjects?.length || 1), 0);
    }
    return this.masterSubjects?.length || 0;
  }

  getGroupCode(grp: any): string {
    if (!grp) return '';
    const raw = (grp.groupCode || grp.group_name || grp.groupName || '').trim();
    const match = raw.match(/^([A-Za-z]+\d+)/);
    if (match) return match[1].toUpperCase();
    return raw;
  }

  getGroupType(groupCode: string): string {
    const code = (groupCode || '').trim().toUpperCase();
    if (code.startsWith('MN')) return 'mn';
    if (code.startsWith('M')) return 'm';
    if (code.startsWith('S')) return 's';
    if (code.startsWith('P')) return 'p';
    return 'other';
  }

  getGroupTypeLabel(groupCode: string): string {
    const type = this.getGroupType(groupCode);
    switch (type) {
      case 'm': return 'หมวดวิชาหลัก (M)';
      case 'mn': return 'หมวดวิชาชีพรอง (MN)';
      case 's': return 'หมวดวิชาสนับสนุน (S)';
      case 'p': return 'หมวดวิชาปฏิบัติ (P)';
      default: return 'กลุ่มวิชา';
    }
  }

  getGroupCreditsText(grp: any): string {
    if (!grp) return '';
    if (grp.is_su) return 'S/U';
    if (grp.isSingle) {
      return `${grp.credit} นก.`;
    }
    return `รวม ${grp.subjects?.length || 0} วิชา (${grp.credit} นก.)`;
  }

  getGroupColorCode(groupName: string, isSingle: boolean): string {
    const name = groupName ? groupName.trim().toUpperCase() : '';
    if (name.startsWith('MN')) return 'FFFFF7ED'; // Orange (Minor)
    if (name.startsWith('M')) return 'FFEBF5FF';  // Blue (Major)
    if (name.startsWith('S')) return 'FFF0FDF4';  // Emerald Green (Supporting)
    if (name.startsWith('P')) return 'FFF5F3FF';  // Violet (Practical)
    return isSingle ? 'FFEBF5FF' : 'FFF0FDF4';
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
      width: '820px',
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
        const code = this.getGroupCode(grp);
        const color = this.getGroupColorCode(code, grp.isSingle);
        const credText = this.getGroupCreditsText(grp);
        const subjects = grp.subjects || [];
        
        if (grp.isSingle) {
          headerRow1.push(`${code}\n(${credText})`);
          const subName = subjects[0]?.name || grp.cleanSubjectName || code;
          headerRow2.push(`${subName}\nเกรด (แต้ม)`);
          colColors[colIndex] = color;
          colIndex++;
        } else {
          headerRow1.push(`${code}\n${credText}`);
          for (let i = 1; i < subjects.length; i++) {
             headerRow1.push(''); // ช่องว่างสำหรับ colspan
          }
          mergeCells.push({ 
            s: worksheet.getColumn(startCol).letter + '1', 
            e: worksheet.getColumn(startCol + subjects.length - 1).letter + '1', 
            color: color 
          });
          
          subjects.forEach(sub => {
             headerRow2.push(`${sub.name}\nเกรด (แต้ม)`);
             colColors[colIndex] = color;
             colIndex++;
          });
        }
      });
    } else {
      this.masterSubjects.forEach(sub => {
        headerRow1.push(`${sub.name}\n(${sub.credit} นก.)`);
        headerRow2.push('เกรด (แต้ม)');
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
           const subjects = grp.subjects || [];

           if (grp.isSingle) {
              if (result) {
                 row.push(this.getNumericGradeDisplay(result.grade, result.index_value, grp.credit) + ` (${result.index_value})`);
              } else {
                 row.push('-');
                 fills.push({ col: cIdx, color: 'FFFFF9C4' }); // สีเหลืองอ่อน ถ้ารอคะแนน
              }
              cIdx++;
           } else {
              // สำหรับกลุ่มรวมหลายวิชา ให้แสดงคะแนนกลุ่มครอบคลุมทั้งกลุ่ม
              if (result) {
                 const gradeText = this.getNumericGradeDisplay(result.grade, result.index_value, grp.credit) + ` (${result.index_value})`;
                 row.push(gradeText);
                 for (let i = 1; i < subjects.length; i++) {
                    row.push('');
                 }
                 const studentRowNumber = index + 3; // แถวที่ 1-2 เป็น header
                 worksheet.mergeCells(worksheet.getColumn(cIdx).letter + studentRowNumber + ':' + worksheet.getColumn(cIdx + subjects.length - 1).letter + studentRowNumber);
              } else {
                 for (let i = 0; i < subjects.length; i++) {
                    row.push('-');
                    fills.push({ col: cIdx + i, color: 'FFFFF9C4' });
                 }
              }
              cIdx += subjects.length;
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
        student.totalScore !== undefined && student.totalScore !== null ? this.formatTotalScore(student.totalScore) : '-',
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

  getGradeBadgeClass(grade: string, indexValue: number | string, credit: number): string {
    const disp = this.getNumericGradeDisplay(grade, indexValue, credit);
    const num = Number(disp);
    if (isNaN(num)) return 'badge-neutral';
    if (num >= 3.5) return 'badge-grade-excellent';
    if (num >= 3.0) return 'badge-grade-very-good';
    if (num >= 2.5) return 'badge-grade-good';
    if (num >= 2.0) return 'badge-grade-fair';
    return 'badge-grade-poor';
  }

  getGradeTooltip(grade: string, indexValue: number | string, credit: number, subjectName: string): string {
    const gradeDisp = this.getNumericGradeDisplay(grade, indexValue, credit);
    const cr = credit ? Number(credit) : 0;
    return `${subjectName}\nเกรด: ${gradeDisp}\nแต้มคะแนนสะสม: ${indexValue}${cr > 0 ? ` (คำนวณจาก ${gradeDisp} × ${cr} นก.)` : ''}`;
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

  formatTotalScore(score: any): string {
    if (score === null || score === undefined || score === '' || isNaN(Number(score))) {
      return '-';
    }
    const num = Number(score);
    // ปัดเศษทศนิยมไม่เกิน 4 ตำแหน่ง เพื่อแก้เศษขยะ float เช่น .1100000000001
    const rounded = Number(num.toFixed(4));
    const parts = rounded.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';

    // ถ้าไม่มีทศนิยมให้ขึ้น .00 ถ้ามี 1 ตำแหน่งให้เติม 0 (เช่น .50) และถ้ามี 2-4 ตำแหน่งให้แสดงตามจริง
    if (decimalPart.length === 0) {
      return `${integerPart}.00`;
    } else if (decimalPart.length === 1) {
      return `${integerPart}.${decimalPart}0`;
    } else {
      return `${integerPart}.${decimalPart}`;
    }
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