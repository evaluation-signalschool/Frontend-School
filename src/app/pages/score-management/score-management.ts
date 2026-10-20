import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

import { DropdownService } from '../../services/dropdown.service';
import { ScoreService } from '../../services/score.service';
import { CourseService, CourseGroup } from '../../services/course.service';
import { Location } from '@angular/common';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { BehaviorScoreDialog } from '../behavior-score-dialog/behavior-score-dialog';

interface Course {
  id: number;
  course_name: string;
}

interface Batch {
  id: number;
  batch_name: string;
}

interface Subject {
  subject_id: number;
  subject_name: string;
  is_su?: boolean;
  group_id?: number;
  group_name?: string;
}

interface SubjectGroupItem {
  group_name: string;
  display_label: string;
  subjects: Subject[];
}

interface StudentScore {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  raw_score: number | null;
}

export interface FailingReviewStudent {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  originalScore: number | null;
  raw_score: number | null;
  isEdited: boolean;
}

@Component({
  selector: 'app-score-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatTabsModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './score-management.html',
  styleUrl: './score-management.scss',
})
export class ScoreManagement implements OnInit, AfterViewInit, OnDestroy {
  courses: Course[] = [];
  courseGroups: CourseGroup[] = []; // เก็บข้อมูลหลักสูตรดิบจาก API พร้อม batches
  batches: Batch[] = [];
  subjects: Subject[] = [];
  groupedSubjects: SubjectGroupItem[] = [];

  selectedCourse: any = 'all';
  selectedBatch: any = null;
  selectedSubjectId: any = null;
  inputMaxScore: number | null = null;

  studentList: StudentScore[] = [];

  filledCount: number = 0;
  maxScoreValue: number | null = null;
  minScoreValue: number | null = null;
  saveError: string = '';
  isSaving: boolean = false;
  isLoading: boolean = false;
  isSaved: boolean = false;
  isMaxScoreSaved: boolean = false;
  isSU: boolean = false;
  showFailingHighlight: boolean = false;
  showScrollTopBtn: boolean = false;
  showScrollBottomBtn: boolean = false;

  private scrollContainer: HTMLElement | null = null;
  private scrollHandler = () => this.checkScroll();

  // Modal ตรวจสอบและแก้ไขคะแนนที่ไม่ถึงเกณฑ์ 70%
  showFailingReviewModal: boolean = false;
  failingReviewStudents: FailingReviewStudent[] = [];

  constructor(
    private dialog: MatDialog,
    private dropdownService: DropdownService,
    private scoreService: ScoreService,
    private courseService: CourseService,
    private location: Location,
    private cdr: ChangeDetectorRef,

    private ngZone: NgZone,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadCourses();
  }

  ngAfterViewInit(): void {
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
    }
  }

  private setupScrollListener(): void {
    this.scrollContainer = document.querySelector('.admin-main-content') as HTMLElement;
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
    setTimeout(() => this.checkScroll(), 250);
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  loadCourses() {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data;
          this.courses = res.data.map((c: any) => ({
            id: c.batches?.[0]?.course_id || c.course_name,
            course_name: c.course_name,
          }));
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to load courses', err),
    });
  }

  getGroupPrefixOrder(name: string): number {
    const upper = (name || '').trim().toUpperCase();
    if (upper.startsWith('M') && !upper.startsWith('MN')) return 1;
    if (upper.startsWith('MN')) return 2;
    if (upper.startsWith('S')) return 3;
    if (upper.startsWith('P')) return 4;
    return 5;
  }

  compareGroupNames(aName: string, bName: string): number {
    const a = (aName || '').trim();
    const b = (bName || '').trim();

    const orderA = this.getGroupPrefixOrder(a);
    const orderB = this.getGroupPrefixOrder(b);
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

  getGroupDisplayLabel(groupName: string): string {
    if (!groupName || groupName === 'ทั่วไป') return 'รายวิชาทั่วไป';
    const nameUpper = groupName.trim().toUpperCase();
    let type = '';
    if (nameUpper.startsWith('MN')) type = 'วิชารอง';
    else if (nameUpper.startsWith('M')) type = 'วิชาหลัก';
    else if (nameUpper.startsWith('S')) type = 'วิชาประกอบ';
    else if (nameUpper.startsWith('P')) type = 'ภาคปฏิบัติ';

    const hasGroupWord = groupName.includes('กลุ่ม') || groupName.includes('หมวด');
    const prefix = hasGroupWord ? '' : 'กลุ่มวิชา ';
    const typeText = type ? ` (${type})` : '';
    return `${prefix}${groupName}${typeText}`;
  }

  loadSubjects(batchId: number) {
    // 1. ล้างข้อมูลวิชาเก่า และล้างค่าวิชาที่เคยเลือกไว้ เพื่อป้องกันข้อมูลตกค้าง
    this.subjects = [];
    this.groupedSubjects = [];
    this.selectedSubjectId = null;
    this.cdr.detectChanges();

    this.dropdownService.getSubjects(batchId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res && res.data && res.data.length > 0) {
            const rawSubjects: Subject[] = res.data;

            // จัดเรียงตามลำดับกลุ่มวิชา (M01 ไปจนถึง P)
            rawSubjects.sort((a, b) => {
              const groupCompare = this.compareGroupNames(a.group_name || '', b.group_name || '');
              if (groupCompare !== 0) return groupCompare;
              return (a.subject_id || 0) - (b.subject_id || 0);
            });

            this.subjects = rawSubjects;

            // จัดกลุ่มวิชาสำหรับแสดงผลใน optgroup
            const groupMap = new Map<string, SubjectGroupItem>();
            for (const subj of rawSubjects) {
              const gName = (subj.group_name || 'ทั่วไป').trim();
              if (!groupMap.has(gName)) {
                groupMap.set(gName, {
                  group_name: gName,
                  display_label: this.getGroupDisplayLabel(gName),
                  subjects: [],
                });
              }
              groupMap.get(gName)!.subjects.push(subj);
            }
            this.groupedSubjects = Array.from(groupMap.values());
          } else {
            this.subjects = [];
            this.groupedSubjects = [];
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Failed to load subjects', err);
          this.subjects = [];
          this.groupedSubjects = [];
          this.cdr.detectChanges();
        });
      },
    });
  }

  loadStudents(batchId: number, subjectId: number) {
    this.isLoading = true;
    this.cdr.detectChanges(); // วาดหน้าจอทันทีเพื่อแสดงสถานะกำลังโหลด

    this.scoreService.getAdminSubjectScores(batchId, subjectId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res?.success && res.data) {
            this.studentList = res.data
              .map((s: any) => ({
                student_id: s.student_id,
                student_code: s.student_code,
                rank_name: s.rank_name || '',
                first_name: s.first_name,
                last_name: s.last_name,
                raw_score:
                  s.raw_score !== null && s.raw_score !== undefined ? Number(s.raw_score) : null,
              }))
              .sort((a: any, b: any) => {
                return String(a.student_code || '').localeCompare(
                  String(b.student_code || ''),
                  undefined,
                  { numeric: true },
                );
              });

            if (res.max_score !== undefined && res.max_score !== null && res.max_score > 0) {
              this.inputMaxScore = res.max_score;
              this.isMaxScoreSaved = true;
            } else {
              this.inputMaxScore = null;
              this.isMaxScoreSaved = false;
            }

            if (res.is_su !== undefined && res.is_su !== null) {
              this.isSU = !!res.is_su;
            } else {
              const subj = this.subjects.find(
                (s: any) => Number(s.subject_id) === Number(this.selectedSubjectId),
              );
              this.isSU = subj?.is_su ?? false;
            }

            if (this.isSU && !this.isMaxScoreSaved) {
              this.isMaxScoreSaved = true;
              this.inputMaxScore = 1;

              this.scoreService
                .updateMaxScore({
                  batch_id: this.selectedBatch,
                  subject_id: this.selectedSubjectId,
                  max_score: 1,
                })
                .subscribe({
                  error: (err) => console.error('Auto-save SU max score failed', err),
                });
            }

            const hasScores = this.studentList.some(
              (s) =>
                s.raw_score !== null && s.raw_score !== undefined && s.raw_score.toString() !== '',
            );
            if (hasScores) {
              this.isSaved = true;
            }

            if (this.isSU) {
              this.studentList.forEach((s) => {
                if (s.raw_score === null || s.raw_score === undefined) {
                  s.raw_score = 1;
                }
              });
            }

            this.updateStats();
          }
          this.isLoading = false;
          this.cdr.detectChanges();
          setTimeout(() => this.checkScroll(), 150);
          setTimeout(() => this.checkScroll(), 400);
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Failed to load students', err);
          this.isLoading = false;
          if (err.status === 404) {
            this.studentList = [];
            this.inputMaxScore = null;
            this.isMaxScoreSaved = false;

            const subj = this.subjects.find(
              (s: any) => Number(s.subject_id) === Number(this.selectedSubjectId),
            );
            this.isSU = subj?.is_su ?? false;

            this.updateStats();
            this.saveError =
              err.error?.message || 'ไม่พบข้อมูลนักเรียนหรือยังไม่ได้ตั้งค่าวิชาในรุ่นที่เลือก';
          }
          this.cdr.detectChanges();
        });
      },
    });
  }

  get validScores(): number[] {
    return this.studentList
      .map((s) => s.raw_score)
      .filter(
        (score): score is number =>
          score !== null && score !== undefined && score.toString() !== '',
      );
  }

  /*get averageScore(): string {
    const scores = this.validScores;
    if (scores.length === 0) return '-';
    const sum = scores.reduce((a, b) => a + Number(b), 0);
    return (sum / scores.length).toFixed(2);
  }*/

  // 1. สร้างตัวแปรธรรมดามารับค่า
  averageScore: string = '-';

  updateStats() {
    const scores = this.validScores;
    this.filledCount = scores.length;
    this.maxScoreValue = scores.length > 0 ? Math.max(...scores) : null;
    this.minScoreValue = scores.length > 0 ? Math.min(...scores) : null;

    if (scores.length === 0) {
      this.averageScore = '-';
    } else {
      const sum = scores.reduce((a, b) => a + Number(b), 0);
      this.averageScore = (sum / scores.length).toFixed(2);
    }
  }

  onCourseChange() {
    this.selectedBatch = null;
    this.selectedSubjectId = null;
    this.subjects = [];
    this.groupedSubjects = [];
    this.studentList = [];
    this.updateStats();

    if (this.selectedCourse && this.selectedCourse !== 'all') {
      // หารุ่นจากข้อมูลที่เก็บไว้ใน courseGroups โดยตรง ไม่ต้องเรียก API ใหม่
      const courseGroup = this.courseGroups.find(
        (c) =>
          c.batches?.[0]?.course_id == this.selectedCourse || c.course_name === this.selectedCourse,
      );
      if (courseGroup) {
        this.batches = courseGroup.batches.map((b) => ({
          id: b.batch_id,
          batch_name: b.batch_name,
        }));
      } else {
        this.batches = [];
      }
    } else {
      this.batches = [];
    }
    this.cdr.detectChanges();
  }

  onBatchChange() {
    this.selectedSubjectId = null;
    this.studentList = [];
    this.updateStats();
    if (this.selectedBatch) {
      this.loadSubjects(this.selectedBatch);
    } else {
      this.subjects = [];
      this.groupedSubjects = [];
    }
    this.cdr.detectChanges();
  }

  // ฟังก์ชันรับค่าเมื่อมีการแก้ไขคะแนนเต็ม
  onMaxScoreChange(newMaxScore: number) {
    this.inputMaxScore = newMaxScore;
    this.cdr.detectChanges();
  }

  onSubjectChange() {
    this.studentList = [];
    this.isSaved = false;
    this.isMaxScoreSaved = false;
    this.saveError = '';
    this.showFailingHighlight = false;
    this.updateStats();

    if (this.selectedBatch && this.selectedSubjectId) {
      this.loadStudents(this.selectedBatch, this.selectedSubjectId);
    }
    this.cdr.detectChanges(); // วาดหน้าจอใหม่ทันที
  }

  onMaxScoreConfirm() {
    if (
      this.selectedSubjectId &&
      this.selectedBatch &&
      (this.inputMaxScore !== null || this.isSU)
    ) {
      const finalMaxScore = this.isSU ? 1 : this.inputMaxScore;
      this.scoreService
        .updateMaxScore({
          batch_id: this.selectedBatch,
          subject_id: this.selectedSubjectId,
          max_score: finalMaxScore as number,
        })
        .pipe(
          finalize(() => {
            this.isSaving = false;
            this.cdr.detectChanges(); // บังคับอัปเดตสถานะ UI อีกครั้งเมื่อจบกระบวนการ
          }),
        )
        .subscribe({
          next: () => {
            console.log('Max score updated');
            // แจ้งเตือนผู้ใช้งานเมื่อบันทึกคะแนนเต็มสำเร็จ
            Swal.fire({
              icon: 'success',
              title: 'สำเร็จ',
              text: 'บันทึกคะแนนเต็มสำเร็จ!',
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#8e44ad',
              background: '#ffffff',
              backdrop: `rgba(0,0,0,0.4)`,
            });
            this.isMaxScoreSaved = true;
            this.cdr.detectChanges(); // ให้ Angular อัปเดต UI ทันที
            // โหลดข้อมูลใหม่เพื่อให้ตารางและค่าต่างๆ อัปเดต
            this.loadStudents(this.selectedBatch, this.selectedSubjectId);
          },
          error: (err) => {
            console.error('Failed to update max score', err);
            Swal.fire({
              icon: 'error',
              title: 'ผิดพลาด',
              text:
                'เกิดข้อผิดพลาดในการอัปเดตคะแนนเต็ม: ' +
                (err.error?.message || err.error?.error || 'ไม่ทราบสาเหตุ'),
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#d33',
            });
          },
        });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณาเลือกรุ่น รายวิชา และกรอกคะแนนเต็มก่อนบันทึก',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#f39c12',
      });
    }
  }

  onScoreInput(student: StudentScore) {
    this.updateStats();
  }

  onScoreChange(student: StudentScore, newScore?: any) {
    if (newScore !== undefined) {
      if (newScore !== null && newScore !== '' && Number(newScore) < 0) {
        // ออโต้แก้ให้เป็น 0 ถ้าพิมพ์ติดลบ
        student.raw_score = 0;
      } else {
        student.raw_score = newScore;
      }
    }
    this.onScoreInput(student);
  }

  isInvalidScore(score: any): boolean {
    if (score === null || score === undefined || score.toString() === '') return false;
    if (this.isSU) return false;
    if (this.inputMaxScore === null) return false;
    const numScore = Number(score);
    const numMax = Number(this.inputMaxScore);
    return numScore < 0 || numScore > numMax;
  }

  focusNextInput(currentIndex: number, event?: Event) {
    if (event) event.preventDefault();
    this.focusInputAtIndex(currentIndex + 1);
  }

  focusInputAtIndex(index: number): void {
    if (index < 0 || index >= this.studentList.length) return;
    const nextInput = document.getElementById('score-input-' + index) as HTMLInputElement;
    if (nextInput) {
      nextInput.focus();
      setTimeout(() => {
        nextInput.select();
      }, 0);
    }
  }

  onScoreKeydown(currentIndex: number, event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      this.focusInputAtIndex(currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusInputAtIndex(currentIndex - 1);
    }
  }

  onInputFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      setTimeout(() => {
        input.select();
      }, 0);
    }
  }

  cleanScoreValue(rawStr: string): string {
    if (!rawStr) return '';

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

    // 3. จัดการเลข 0 นำหน้า (Leading Zeros) เช่น 090 -> 90, 05 -> 5
    if (cleaned.includes('.')) {
      let [intPart, decPart] = cleaned.split('.');
      if (intPart.length > 1 && intPart.startsWith('0')) {
        intPart = intPart.replace(/^0+(?=[0-9])/, '');
        if (intPart === '') intPart = '0';
      }
      cleaned = intPart + '.' + decPart;
    } else {
      if (cleaned.length > 1 && cleaned.startsWith('0')) {
        cleaned = cleaned.replace(/^0+(?=[1-9])/, '');
        if (/^0+$/.test(cleaned)) {
          cleaned = '0';
        }
      }
    }

    return cleaned;
  }

  onScoreInputChange(student: StudentScore, event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value;
    const cleaned = this.cleanScoreValue(rawValue);

    if (cleaned !== rawValue) {
      input.value = cleaned;
    }

    if (cleaned === '') {
      student.raw_score = null;
    } else if (cleaned.endsWith('.')) {
      // กำลังพิมพ์จุด เช่น '1.' ให้แปลงเป็นตัวเลขสำหรับคำนวณ Progress bar ชั่วคราว
      student.raw_score = Number(cleaned.slice(0, -1));
    } else {
      student.raw_score = Number(cleaned);
    }

    this.onScoreInput(student);
  }

  onScoreInputBlur(student: StudentScore, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.trim();
    if (val.endsWith('.')) {
      val = val.slice(0, -1);
      input.value = val;
    }
    if (val === '') {
      student.raw_score = null;
    } else {
      student.raw_score = Number(val);
    }
    this.updateStats();
  }

  async fillScoreForEveryone() {
    if (!this.inputMaxScore) {
      Swal.fire('แจ้งเตือน', 'กรุณากำหนดคะแนนเต็มก่อน', 'warning');
      return;
    }

    const { value: score } = await Swal.fire({
      title: 'กรอกคะแนนให้ทุกคน',
      input: 'number',
      inputLabel: `ระบุคะแนนที่ต้องการเติมให้ทุกคน (คะแนนเต็ม ${this.inputMaxScore})`,
      inputPlaceholder: 'ตัวเลขคะแนน',
      showCancelButton: true,
      confirmButtonText: 'เติมคะแนน',
      cancelButtonText: 'ยกเลิก',
      inputAttributes: {
        min: '0',
        max: this.inputMaxScore.toString(),
        step: '0.5',
      },
      inputValidator: (value) => {
        if (!value) {
          return 'กรุณาระบุคะแนน';
        }
        if (Number(value) < 0 || Number(value) > (this.inputMaxScore || 100)) {
          return `คะแนนต้องอยู่ระหว่าง 0 ถึง ${this.inputMaxScore}`;
        }
        return null;
      },
    });

    if (score !== undefined && score !== null && score !== '') {
      const numScore = Number(score);
      this.ngZone.run(() => {
        this.studentList.forEach((student) => {
          student.raw_score = numScore;
        });
        this.updateStats();
        this.cdr.detectChanges();
      });
    }
  }

  onCancel() {
    this.selectedSubjectId = null;
    this.cdr.detectChanges();
  }

  onSaveScores() {
    if (!this.selectedSubjectId || !this.selectedBatch) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณาเลือกรุ่นและรายวิชาก่อนบันทึกคะแนน',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8e44ad',
      });
      return;
    }

    const studentsToSave = this.studentList.filter(
      (s) => s.raw_score !== null && s.raw_score !== undefined && s.raw_score.toString() !== '',
    );

    if (studentsToSave.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'ไม่มีข้อมูล',
        text: 'ไม่มีคะแนนให้บันทึก',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8e44ad',
      });
      return;
    }

    const hasInvalidScores = studentsToSave.some((s) => {
      if (this.isSU) return false;
      const score = Number(s.raw_score);
      const max = Number(this.inputMaxScore);
      return score < 0 || score > max;
    });
    if (hasInvalidScores) {
      Swal.fire({
        icon: 'warning',
        title: 'คะแนนไม่ถูกต้อง',
        text: 'กรุณาตรวจสอบคะแนน (ห้ามติดลบ และต้องไม่เกินคะแนนเต็ม)',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#d33',
      });
      return;
    }

    const maxScore = Number(this.inputMaxScore);
    const passThreshold = maxScore * 0.7;
    const failingStudents = this.isSU
      ? []
      : studentsToSave.filter((s) => Number(s.raw_score) < passThreshold);

    if (failingStudents.length > 0) {
      this.openFailingReviewModal(failingStudents);
      return;
    }

    this.executeSave(studentsToSave);
  }

  // --- จัดการ Modal ตรวจสอบและแก้ไขคะแนนต่ำกว่าเกณฑ์ 70% ---
  openFailingReviewModal(failingStudents: StudentScore[]): void {
    this.failingReviewStudents = failingStudents.map((s) => ({
      student_id: s.student_id,
      student_code: s.student_code,
      rank_name: s.rank_name || '',
      first_name: s.first_name,
      last_name: s.last_name,
      originalScore: s.raw_score,
      raw_score: s.raw_score,
      isEdited: false,
    }));
    this.showFailingHighlight = true;
    this.showFailingReviewModal = true;
    this.cdr.detectChanges();
  }

  closeFailingReviewModal(): void {
    this.showFailingReviewModal = false;
    this.cdr.detectChanges();
  }

  onReviewScoreInput(item: FailingReviewStudent, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim();
    if (val === '') {
      item.raw_score = null;
    } else {
      const num = Number(val);
      item.raw_score = isNaN(num) ? null : num;
    }
    item.isEdited = item.raw_score !== item.originalScore;
  }

  resetReviewScore(item: FailingReviewStudent): void {
    item.raw_score = item.originalScore;
    item.isEdited = false;
  }

  getReviewPassingThreshold(): number {
    return Number(this.inputMaxScore || 0) * 0.7;
  }

  isReviewItemPassing(score: any): boolean {
    if (score === null || score === undefined || score === '') return false;
    return Number(score) >= this.getReviewPassingThreshold();
  }

  isReviewItemInvalid(score: any): boolean {
    if (score === null || score === undefined || score === '') return false;
    const num = Number(score);
    return num < 0 || num > Number(this.inputMaxScore || 0);
  }

  getRemainingFailingCount(): number {
    const threshold = this.getReviewPassingThreshold();
    return this.failingReviewStudents.filter(
      (item) => item.raw_score === null || Number(item.raw_score) < threshold
    ).length;
  }

  getAdjustedPassingCount(): number {
    const threshold = this.getReviewPassingThreshold();
    return this.failingReviewStudents.filter(
      (item) => item.raw_score !== null && Number(item.raw_score) >= threshold
    ).length;
  }

  getSelectedSubjectName(): string {
    return (
      this.subjects.find((s) => s.subject_id === this.selectedSubjectId)?.subject_name ||
      'รายวิชา'
    );
  }

  confirmFailingReviewSave(): void {
    // 1. ตรวจสอบว่ามีคะแนนที่กรอกผิด (ติดลบ หรือ เกินคะแนนเต็ม) หรือไม่
    const hasInvalid = this.failingReviewStudents.some((item) =>
      this.isReviewItemInvalid(item.raw_score)
    );
    if (hasInvalid) {
      Swal.fire({
        icon: 'warning',
        title: 'คะแนนไม่ถูกต้อง',
        text: `กรุณากรอกคะแนนให้อยู่ระหว่าง 0 ถึง ${this.inputMaxScore} คะแนน (ห้ามติดลบ และไม่เกินคะแนนเต็ม)`,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8e44ad',
      });
      return;
    }

    // 2. นำคะแนนที่แก้ไขใน Modal ไปอัปเดตใส่ studentList
    this.failingReviewStudents.forEach((item) => {
      const student = this.studentList.find((s) => s.student_id === item.student_id);
      if (student) {
        student.raw_score =
          item.raw_score !== null && item.raw_score !== undefined
            ? Number(item.raw_score)
            : null;
      }
    });

    this.updateStats();
    this.showFailingReviewModal = false;
    this.cdr.detectChanges();

    // 3. ดำเนินการบันทึก
    const studentsToSave = this.studentList.filter(
      (s) => s.raw_score !== null && s.raw_score !== undefined && s.raw_score.toString() !== '',
    );
    this.executeSave(studentsToSave);
  }

  isFailingScore(score: any): boolean {
    if (this.isSU) return score === 0;
    if (!this.inputMaxScore || score === null || score === undefined || score.toString() === '')
      return false;
    return Number(score) < Number(this.inputMaxScore) * 0.7;
  }

  private executeSave(studentsToSave: any[]) {
    this.isSaving = true;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.cdr.detectChanges();

    this.saveError = '';

    const payload = {
      batch_id: this.selectedBatch,
      subject_id: this.selectedSubjectId,
      scores: studentsToSave.map((s) => ({
        student_id: s.student_id,
        raw_score: Number(s.raw_score),
      })),
    };

    this.scoreService.saveAdminBulkScores(payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.isSaved = true;
        this.saveError = '';
        this.cdr.detectChanges(); // อัปเดต UI ให้ปุ่มกลายเป็นสีเทาและฟิลด์ถูกล็อคทันที

        // แจ้งเตือนสำเร็จด้วย SweetAlert2
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: `บันทึกคะแนน ${studentsToSave.length} คน เรียบร้อยแล้ว`,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#8e44ad',
          background: '#ffffff',
          backdrop: `rgba(0,0,0,0.4)`,
        }).then(() => {
          this.cdr.detectChanges(); // เผื่อกรณี UI หายไปหลังป๊อปอัปปิด
        });
      },
      error: (err) => {
        this.isSaving = false;
        this.saveError = 'เกิดข้อผิดพลาดในการบันทึกคะแนน';
        console.error(err);
        this.cdr.detectChanges(); // อัปเดตข้อความ Error ให้แสดงบน UI ทันที

        Swal.fire({
          icon: 'error',
          title: 'ผิดพลาด',
          text: 'เกิดข้อผิดพลาดในการบันทึกคะแนน โปรดลองใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#d33',
        });
      },
    });
  }

  // ฟังก์ชันสำหรับการกดปุ่มแก้ไขคะแนน
  enableEditMode() {
    this.isSaved = false;
    this.saveError = '';
    this.cdr.detectChanges();
  }

  enableMaxScoreEdit() {
    this.isMaxScoreSaved = false;
    this.cdr.detectChanges();
  }

  goToNextSubject() {
    const currentIndex = this.subjects.findIndex((s) => s.subject_id == this.selectedSubjectId);
    const nextIndex = currentIndex + 1;
    if (nextIndex < this.subjects.length) {
      this.selectedSubjectId = this.subjects[nextIndex].subject_id;
      this.onSubjectChange();
      this.scrollToTop();
    }
  }

  goToScorePage() {
    this.router.navigate(['/admin/ScoreList']);
  }

  goToTrainingExamTime() {
    this.router.navigate(['/admin/training-exam-time']);
  }

  openBehaviorScoreModal(): void {
    if (!this.selectedBatch) {
      Swal.fire({
        icon: 'info',
        title: 'กรุณาเลือกรุ่น',
        text: 'กรุณาเลือกโครงสร้างหลักสูตรและรุ่นก่อนบันทึกคะแนนความประพฤติ',
        confirmButtonColor: '#8e44ad',
      });
      return;
    }

    const batchObj = this.batches.find((b) => Number(b.id) === Number(this.selectedBatch));
    const courseObj = this.courses.find((c) => Number(c.id) === Number(this.selectedCourse));

    const dialogRef = this.dialog.open(BehaviorScoreDialog, {
      data: {
        batchId: this.selectedBatch,
        batchName: batchObj ? batchObj.batch_name : '',
        courseName: courseObj ? courseObj.course_name : '',
      },
      width: '850px',
      maxWidth: '95vw',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((saved) => {
      if (saved) {
        // Updated successfully
      }
    });
  }

  goToPreviousSubject() {
    const currentIndex = this.subjects.findIndex((s) => s.subject_id == this.selectedSubjectId);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      this.selectedSubjectId = this.subjects[prevIndex].subject_id;
      this.onSubjectChange();
      this.scrollToTop();
    }
  }

  onBottomSubjectChange() {
    this.onSubjectChange();
    this.scrollToTop();
  }

  checkScroll() {
    let scrollOffset = 0;
    let windowHeight = 0;
    let documentHeight = 0;

    const container = this.scrollContainer || (document.querySelector('.admin-main-content') as HTMLElement);
    if (container && container.scrollHeight > container.clientHeight) {
      this.scrollContainer = container;
      scrollOffset = container.scrollTop;
      windowHeight = container.clientHeight;
      documentHeight = container.scrollHeight;
    } else {
      scrollOffset =
        window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      windowHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
      );
    }

    this.showScrollTopBtn = scrollOffset > 150;
    const isNearBottom = scrollOffset + windowHeight >= documentHeight - 120;
    this.showScrollBottomBtn = this.studentList.length > 5 && !isNearBottom;
    this.cdr.detectChanges();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.checkScroll();
  }

  scrollToTop() {
    const container = this.scrollContainer || (document.querySelector('.admin-main-content') as HTMLElement);
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToBottom() {
    const container = this.scrollContainer || (document.querySelector('.admin-main-content') as HTMLElement);
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
    window.scrollTo({
      top: document.documentElement.scrollHeight || document.body.scrollHeight,
      behavior: 'smooth',
    });
  }

  get hasPreviousSubject(): boolean {
    const currentIndex = this.subjects.findIndex((s) => s.subject_id == this.selectedSubjectId);
    return currentIndex > 0;
  }

  get hasNextSubject(): boolean {
    const currentIndex = this.subjects.findIndex((s) => s.subject_id == this.selectedSubjectId);
    return currentIndex >= 0 && currentIndex < this.subjects.length - 1;
  }

  async exportToExcel() {
    if (!this.studentList || this.studentList.length === 0) {
      Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลนักเรียนให้ Export', 'warning');
      return;
    }

    const subjectName =
      this.subjects.find((s) => s.subject_id === this.selectedSubjectId)?.subject_name || 'รายวิชา';
    const batchName = this.batches.find((b) => b.id === this.selectedBatch)?.batch_name || 'รุ่น';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('คะแนนรายวิชา');

    worksheet.properties.defaultRowHeight = 25;

    let headers: string[];
    if (this.isSU) {
      headers = ['ลำดับ', 'รหัสนักเรียน', 'ยศ', 'ชื่อ', 'นามสกุล', 'ผลการประเมิน'];
    } else {
      headers = [
        'ลำดับ',
        'รหัสนักเรียน',
        'ยศ',
        'ชื่อ',
        'นามสกุล',
        'คะแนนดิบ',
        'คะแนนเต็ม',
        'คิดเป็นเปอร์เซ็นต์',
      ];
    }

    // เพิ่มหัวตาราง
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Sarabun', size: 12, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // เพิ่มข้อมูลนักเรียน
    this.studentList.forEach((student, index) => {
      const rowData = [
        index + 1,
        student.student_code || '-',
        student.rank_name || '',
        student.first_name || '',
        student.last_name || '',
      ];

      if (this.isSU) {
        let suResult = 'ยังไม่ประเมิน';
        if (student.raw_score === 1) suResult = 'S (ผ่าน)';
        else if (student.raw_score === 0) suResult = 'U (ไม่ผ่าน)';
        rowData.push(suResult);
      } else {
        const rawScore =
          student.raw_score !== null && student.raw_score !== undefined
            ? student.raw_score
            : 'ยังไม่กรอก';
        const maxScore = this.inputMaxScore || '-';
        let percentage = '-';
        if (student.raw_score !== null && student.raw_score !== undefined && this.inputMaxScore) {
          let pct = (student.raw_score / this.inputMaxScore) * 100;
          if (pct > 100) pct = 100;
          percentage = pct.toFixed(2) + '%';
        }
        rowData.push(rawScore, maxScore, percentage);
      }

      const excelRow = worksheet.addRow(rowData);
      excelRow.eachCell((cell) => {
        cell.font = { name: 'Sarabun', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // ปรับขนาดคอลัมน์
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });
    worksheet.getColumn(4).width = 20; // ชื่อ
    worksheet.getColumn(5).width = 20; // นามสกุล

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `คะแนน_${subjectName}_${batchName}.xlsx`);
  }
}
