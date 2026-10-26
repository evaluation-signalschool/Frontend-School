import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, finalize, catchError } from 'rxjs';
import { DropdownService } from '../../services/dropdown.service';
import { ScoreService } from '../../services/score.service';
import { StudentService } from '../../services/student.service';
import { CourseService, CourseGroup } from '../../services/course.service';
import Swal from 'sweetalert2';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface StudentTimeRecord {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  affiliation: string;
  trainingTimeScore: number | null;
  examTimeScore: number | null;
  behaviorScore: number | null;
  gpa: string;
  gradeLevel: string;
  rank: number | null;
  isModified?: boolean;
}

const STORAGE_KEY_SELECTION = 'training_exam_time_last_selection';

@Component({
  selector: 'app-training-exam-time',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './training-exam-time.html',
  styleUrl: './training-exam-time.scss',
})
export class TrainingExamTime implements OnInit {
  courseGroups: CourseGroup[] = [];
  batches: any[] = [];

  selectedCourse: any = 'all';
  selectedBatch: any = null;

  students: StudentTimeRecord[] = [];
  filteredStudents: StudentTimeRecord[] = [];

  searchQuery: string = '';
  filterMode: 'all' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' = 'all';
  sortBy: 'code' | 'rank' | 'gpa' | 'behavior' = 'code';
  sortDirection: 'asc' | 'desc' = 'asc';

  isLoadingCourses: boolean = false;
  isLoadingStudents: boolean = false;
  isSaving: boolean = false;
  isSaved: boolean = false;
  hasUnsavedChanges: boolean = false;

  constructor(
    private router: Router,
    private dropdownService: DropdownService,
    private scoreService: ScoreService,
    private studentService: StudentService,
    private courseService: CourseService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.getCourses().subscribe({
      next: (res: any) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data || [];
        } else if (Array.isArray(res)) {
          this.courseGroups = res;
        } else {
          this.courseGroups = [];
        }
        this.isLoadingCourses = false;

        // ดึงค่าการเลือกล่าสุดจาก Storage
        this.restoreLastSelection();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoadingCourses = false;
        console.error('Error loading course groups:', err);
      },
    });
  }

  restoreLastSelection(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SELECTION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.courseId) {
          this.selectedCourse = parsed.courseId;
          this.onCourseChange(false);
          if (parsed.batchId) {
            this.selectedBatch = parsed.batchId;
            this.onBatchChange();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore selection:', e);
    }
  }

  saveSelection(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY_SELECTION,
        JSON.stringify({
          courseId: this.selectedCourse,
          batchId: this.selectedBatch,
        }),
      );
    } catch (e) {
      console.warn('Failed to save selection:', e);
    }
  }

  onCourseChange(resetBatch: boolean = true): void {
    if (resetBatch) {
      this.selectedBatch = null;
      this.students = [];
      this.filteredStudents = [];
    }

    if (this.selectedCourse === 'all' || !this.selectedCourse) {
      this.batches = [];
      return;
    }

    const group = this.courseGroups.find(
      (cg) =>
        String(cg.course_name) === String(this.selectedCourse) ||
        cg.batches?.some(
          (b: any) =>
            String(b.course_id) === String(this.selectedCourse) ||
            String(b.batch_id) === String(this.selectedCourse),
        ),
    );

    if (group && group.batches) {
      this.batches = group.batches.map((b: any) => ({
        id: b.batch_id || b.id,
        batch_id: b.batch_id || b.id,
        batch_name: b.batch_name || `รุ่นที่ ${b.batch_id || b.id}`,
        course_id: b.course_id,
      }));
    } else {
      this.batches = [];
    }
  }

  onBatchChange(): void {
    if (!this.selectedBatch) {
      this.students = [];
      this.filteredStudents = [];
      return;
    }

    this.saveSelection();
    this.loadBatchStudents();
  }

  loadBatchStudents(): void {
    if (!this.selectedBatch) return;

    this.isLoadingStudents = true;
    this.hasUnsavedChanges = false;
    this.isSaved = false;
    const batchId = Number(this.selectedBatch);

    // ดึงข้อมูลทั้ง Ranking (มี GPA และอันดับ), SummaryScores (เวลาฝึกอบรม/สอบ/สังกัด), และ BatchScores
    forkJoin({
      rankingRes: this.scoreService.getBatchRanking(batchId).pipe(
        catchError((e) => {
          console.warn('Ranking fetch failed, continuing with fallback:', e);
          return of(null);
        }),
      ),
      summaryRes: this.scoreService.getBatchSummaryScores(batchId).pipe(
        catchError((e) => {
          console.warn('Summary fetch failed, continuing with fallback:', e);
          return of(null);
        }),
      ),
      batchScoresRes: this.scoreService.getBatchScoresSummary(batchId).pipe(
        catchError((e) => {
          console.warn('Batch scores summary fetch failed:', e);
          return of(null);
        }),
      ),
    }).subscribe({
      next: ({ rankingRes, summaryRes, batchScoresRes }) => {
        this.isLoadingStudents = false;
        const rankingList = rankingRes?.data || (Array.isArray(rankingRes) ? rankingRes : []);
        const summaryList = summaryRes?.data || (Array.isArray(summaryRes) ? summaryRes : []);
        const batchScoresList = batchScoresRes?.data || (Array.isArray(batchScoresRes) ? batchScoresRes : []);

        if (rankingList.length > 0 || summaryList.length > 0 || batchScoresList.length > 0) {
          this.processStudentsData(rankingList, summaryList, batchScoresList, batchId);
        } else {
          this.fallbackLoadStudents(batchId);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Error loading batch data:', err);
        this.fallbackLoadStudents(batchId);
      },
    });
  }

  private processStudentsData(
    rankingList: any[],
    summaryList: any[],
    batchScoresList: any[],
    batchId: number,
  ): void {
    const summaryMap = new Map<number, any>();
    summaryList.forEach((s) => {
      const id = s.student_id || s.id;
      if (id) summaryMap.set(Number(id), s);
    });

    const rankingMap = new Map<number, any>();
    rankingList.forEach((s) => {
      const id = s.student_id || s.id;
      if (id) rankingMap.set(Number(id), s);
    });

    const batchScoreMap = new Map<number, any>();
    batchScoresList.forEach((s) => {
      const id = s.student_id || s.id;
      if (id) batchScoreMap.set(Number(id), s);
    });

    // เลือกลิสต์ตั้งต้นที่มีข้อมูลครบที่สุด
    let baseList = summaryList;
    if (rankingList.length > baseList.length) baseList = rankingList;
    if (batchScoresList.length > baseList.length) baseList = batchScoresList;

    this.students = baseList.map((st: any) => {
      const studentId = Number(st.student_id || st.id);
      const sumInfo = summaryMap.get(studentId) || st;
      const rankInfo = rankingMap.get(studentId) || st;
      const bScoreInfo = batchScoreMap.get(studentId) || st;

      const trainScore =
        sumInfo.training_time_score !== null && sumInfo.training_time_score !== undefined
          ? Number(sumInfo.training_time_score)
          : rankInfo.training_time_score !== null && rankInfo.training_time_score !== undefined
            ? Number(rankInfo.training_time_score)
            : 100;

      const examScore =
        sumInfo.exam_time_score !== null && sumInfo.exam_time_score !== undefined
          ? Number(sumInfo.exam_time_score)
          : rankInfo.exam_time_score !== null && rankInfo.exam_time_score !== undefined
            ? Number(rankInfo.exam_time_score)
            : 100;

      const behavScore =
        sumInfo.behavior_score !== null && sumInfo.behavior_score !== undefined
          ? Number(sumInfo.behavior_score)
          : rankInfo.behavior_score !== null && rankInfo.behavior_score !== undefined
            ? Number(rankInfo.behavior_score)
            : bScoreInfo.behavior_score !== null && bScoreInfo.behavior_score !== undefined
              ? Number(bScoreInfo.behavior_score)
              : 200;

      // GPA: ดึงจาก rankingInfo ก่อน หากไม่มีให้ดึงจาก bScoreInfo
      let gpaVal: number | null = null;
      if (rankInfo.gpa !== undefined && rankInfo.gpa !== null && rankInfo.gpa !== '') {
        const parsed = Number(rankInfo.gpa);
        if (!isNaN(parsed)) gpaVal = parsed;
      } else if (bScoreInfo.gpa !== undefined && bScoreInfo.gpa !== null && bScoreInfo.gpa !== '') {
        const parsed = Number(bScoreInfo.gpa);
        if (!isNaN(parsed)) gpaVal = parsed;
      }

      const gpaStr = gpaVal !== null ? gpaVal.toFixed(2) : '-';
      const rankVal = rankInfo.manualRank ?? rankInfo.calculatedRank ?? null;
      const gradeLvl = this.getGradeLevel(gpaVal);

      return {
        student_id: studentId,
        student_code: st.student_code || sumInfo.student_code || rankInfo.student_code || '',
        rank_name: st.rank_name || sumInfo.rank_name || rankInfo.rank_name || '',
        first_name: st.first_name || sumInfo.first_name || rankInfo.first_name || '',
        last_name: st.last_name || sumInfo.last_name || rankInfo.last_name || '',
        affiliation: sumInfo.affiliation || rankInfo.affiliation || bScoreInfo.affiliation || '',
        trainingTimeScore: trainScore,
        examTimeScore: examScore,
        behaviorScore: behavScore,
        gpa: gpaStr,
        gradeLevel: gradeLvl,
        rank: rankVal,
        isModified: false,
      };
    });

    // หากยังไม่มีการจัดอันดับจากเซิร์ฟเวอร์ ให้คำนวณอันดับตาม GPA มากไปน้อยอัตโนมัติ
    if (this.students.every((s) => !s.rank) && this.students.some((s) => s.gpa !== '-')) {
      const gpaStudents = [...this.students]
        .filter((s) => s.gpa !== '-')
        .sort((a, b) => Number(b.gpa) - Number(a.gpa));
      gpaStudents.forEach((s, idx) => {
        const found = this.students.find((orig) => orig.student_id === s.student_id);
        if (found) found.rank = idx + 1;
      });
    }

    // เรียงตามเลขที่ (student_code) เป็นค่าเริ่มต้น
    this.sortStudents('code');
  }

  private fallbackLoadStudents(batchId: number): void {
    this.studentService.getStudents(String(batchId)).subscribe({
      next: (studentRes: any) => {
        this.isLoadingStudents = false;
        const list = Array.isArray(studentRes) ? studentRes : studentRes?.data || [];
        if (list && list.length > 0) {
          this.students = list.map((st: any) => ({
            student_id: st.id || st.student_id,
            student_code: st.student_code || '',
            rank_name: st.rank_name || '',
            first_name: st.first_name || '',
            last_name: st.last_name || '',
            affiliation: st.affiliation || '',
            trainingTimeScore: 100,
            examTimeScore: 100,
            behaviorScore: 200,
            gpa: '-',
            gradeLevel: '-',
            rank: null,
            isModified: false,
          }));
          this.applyFilter();
        } else {
          this.students = [];
          this.filteredStudents = [];
        }
        this.cdr.detectChanges();
      },
      error: (stErr: any) => {
        this.isLoadingStudents = false;
        console.error('Error loading fallback students:', stErr);
        this.students = [];
        this.filteredStudents = [];
        this.cdr.detectChanges();
      },
    });
  }

  // --- Grade Level Calculation (สูตรเกรดตามที่ระบุ) ---
  // IF(G11>=3.5,"ดีเลิศ",IF(G11>=3,"ดีมาก",IF(G11>=2.5,"ดี",IF(G11>=2,"พอใช้",IF(G11<2,"ไม่พอใช้",)))))
  getGradeLevel(gpa: any): string {
    if (gpa === null || gpa === undefined || gpa === '' || isNaN(Number(gpa))) {
      return '-';
    }
    const val = Number(gpa);
    if (val >= 3.5) return 'ดีเลิศ';
    if (val >= 3.0) return 'ดีมาก';
    if (val >= 2.5) return 'ดี';
    if (val >= 2.0) return 'พอใช้';
    return 'ไม่พอใช้';
  }

  getGradeLevelClass(level: string): string {
    switch (level) {
      case 'ดีเลิศ':
        return 'badge-excellent';
      case 'ดีมาก':
        return 'badge-very-good';
      case 'ดี':
        return 'badge-good';
      case 'พอใช้':
        return 'badge-fair';
      case 'ไม่พอใช้':
        return 'badge-poor';
      default:
        return 'badge-neutral';
    }
  }

  // --- Summary Statistics Getters ---
  get totalCount(): number {
    return this.students.length;
  }

  get averageGpa(): string {
    const validScores = this.students
      .map((s) => Number(s.gpa))
      .filter((v) => !isNaN(v) && v > 0);
    if (validScores.length === 0) return '-';
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    return (sum / validScores.length).toFixed(2);
  }

  get excellentCount(): number {
    return this.students.filter((s) => s.gradeLevel === 'ดีเลิศ').length;
  }

  get veryGoodCount(): number {
    return this.students.filter((s) => s.gradeLevel === 'ดีมาก').length;
  }

  get goodCount(): number {
    return this.students.filter((s) => s.gradeLevel === 'ดี').length;
  }

  get fairCount(): number {
    return this.students.filter((s) => s.gradeLevel === 'พอใช้').length;
  }

  get poorCount(): number {
    return this.students.filter((s) => s.gradeLevel === 'ไม่พอใช้').length;
  }

  setFilterMode(mode: 'all' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor'): void {
    this.filterMode = mode;
    this.applyFilter();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  quickFillTraining100(): void {
    this.students.forEach((s) => {
      s.trainingTimeScore = 100;
      s.isModified = true;
    });
    this.hasUnsavedChanges = true;
    this.isSaved = false;
    this.cdr.detectChanges();
  }

  quickFillExam100(): void {
    this.students.forEach((s) => {
      s.examTimeScore = 100;
      s.isModified = true;
    });
    this.hasUnsavedChanges = true;
    this.isSaved = false;
    this.cdr.detectChanges();
  }

  quickFillBehavior200(): void {
    this.students.forEach((s) => {
      s.behaviorScore = 200;
      s.isModified = true;
    });
    this.hasUnsavedChanges = true;
    this.isSaved = false;
    this.cdr.detectChanges();
  }

  cleanScoreValue(rawStr: string, maxVal: number = 100): { cleanedStr: string; numVal: number | null } {
    if (rawStr === null || rawStr === undefined || String(rawStr).trim() === '') {
      return { cleanedStr: '', numVal: null };
    }

    const str = String(rawStr).trim();
    const isNegative = str.startsWith('-');

    // 1. อนุญาตเฉพาะตัวเลข 0-9 และจุดทศนิยม .
    let cleaned = str.replace(/[^0-9.]/g, '');

    // 2. ป้องกันจุดทศนิยมซ้ำ เช่น 1.2.3 -> ให้เหลือจุดเดียว
    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex !== -1) {
      const intPart = cleaned.substring(0, firstDotIndex);
      const decPart = cleaned.substring(firstDotIndex + 1).replace(/\./g, '');
      // จำกัดทศนิยมสูงสุดไม่เกิน 2 ตำแหน่ง
      cleaned = (intPart === '' ? '0' : intPart) + '.' + decPart.slice(0, 2);
    }

    // 3. จัดการเลข 0 นำหน้า (Leading Zeros) เช่น 00 -> 0, 05 -> 5
    if (cleaned.includes('.')) {
      let [intPart, decPart] = cleaned.split('.');
      if (intPart.length > 1 && intPart.startsWith('0')) {
        intPart = intPart.replace(/^0+(?=[0-9])/, '') || '0';
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

    // รองรับเครื่องหมายลบเพื่อให้ผู้ใช้สามารถพิมพ์หรือทดสอบเคสค่าติดลบได้
    if (isNegative) {
      if (cleaned === '') {
        cleaned = '-';
      } else if (!cleaned.startsWith('-')) {
        cleaned = '-' + cleaned;
      }
    }

    let numVal: number | null = null;
    if (cleaned !== '' && cleaned !== '.' && cleaned !== '-') {
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        numVal = parsed;
      }
    }

    return { cleanedStr: cleaned, numVal };
  }

  isScoreInvalid(val: number | null | undefined, max: number = 100): boolean {
    if (val === null || val === undefined || String(val).trim() === '') return false;
    const num = Number(val);
    return isNaN(num) || num > max || num < 0;
  }

  isScoreEmpty(val: number | null | undefined): boolean {
    return val === null || val === undefined || String(val).trim() === '';
  }

  validateScore(
    student: StudentTimeRecord,
    field: 'trainingTimeScore' | 'examTimeScore' | 'behaviorScore',
    event: any,
  ): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    const maxVal = field === 'behaviorScore' ? 200 : 100;
    const { cleanedStr, numVal } = this.cleanScoreValue(rawVal, maxVal);

    input.value = cleanedStr;
    // หากพิมพ์เฉพาะเครื่องหมาย '-' ชั่วคราว ให้เก็บเป็น NaN เพื่อรอตัวเลข
    student[field] = cleanedStr === '-' ? NaN : numVal;
    student.isModified = true;
    this.hasUnsavedChanges = true;
    this.isSaved = false;
    this.cdr.detectChanges();
  }

  onScoreBlur(
    student: StudentTimeRecord,
    field: 'trainingTimeScore' | 'examTimeScore' | 'behaviorScore',
    event: any,
  ): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    const maxVal = field === 'behaviorScore' ? 200 : 100;
    const { cleanedStr, numVal } = this.cleanScoreValue(rawVal, maxVal);

    if (cleanedStr === '' || numVal === null) {
      if (field === 'behaviorScore') {
        // หากปล่อยว่างไว้ ให้รีเซ็ตเป็นค่าเริ่มต้นเต็ม 200 คะแนน
        input.value = '200';
        student.behaviorScore = 200;
      } else {
        if (cleanedStr === '-') {
          input.value = '-';
          student[field] = NaN;
        } else {
          input.value = '';
          student[field] = null;
        }
      }
    } else {
      input.value = cleanedStr;
      student[field] = numVal;
    }
    this.cdr.detectChanges();
  }

  onWheel(event: WheelEvent): void {
    (event.target as HTMLElement)?.blur();
  }

  getSelectedCourseName(): string {
    if (!this.selectedCourse || this.selectedCourse === 'all') return '';
    const group = this.courseGroups.find(
      (cg) =>
        String(cg.course_name) === String(this.selectedCourse) ||
        cg.batches?.some(
          (b: any) =>
            String(b.course_id) === String(this.selectedCourse) ||
            String(b.batch_id) === String(this.selectedCourse),
        ),
    );
    return group?.course_name || String(this.selectedCourse);
  }

  getSelectedBatchName(): string {
    if (!this.selectedBatch) return '';
    const b = this.batches.find(
      (item) => String(item.batch_id || item.id) === String(this.selectedBatch),
    );
    return b?.batch_name || `รุ่นที่ ${this.selectedBatch}`;
  }

  // --- Sorting Tools ---
  sortStudents(by: 'code' | 'rank' | 'gpa' | 'behavior'): void {
    if (this.sortBy === by) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = by;
      this.sortDirection = by === 'gpa' || by === 'behavior' ? 'desc' : 'asc';
    }

    this.students.sort((a, b) => {
      let res = 0;
      if (by === 'code') {
        const numA = Number(a.student_code);
        const numB = Number(b.student_code);
        if (!isNaN(numA) && !isNaN(numB)) res = numA - numB;
        else res = a.student_code.localeCompare(b.student_code);
      } else if (by === 'rank') {
        const rankA = a.rank ?? 9999;
        const rankB = b.rank ?? 9999;
        res = rankA - rankB;
      } else if (by === 'gpa') {
        const gpaA = a.gpa !== '-' ? Number(a.gpa) : -1;
        const gpaB = b.gpa !== '-' ? Number(b.gpa) : -1;
        res = gpaB - gpaA;
      } else if (by === 'behavior') {
        const behA = a.behaviorScore !== null && a.behaviorScore !== undefined ? Number(a.behaviorScore) : 200;
        const behB = b.behaviorScore !== null && b.behaviorScore !== undefined ? Number(b.behaviorScore) : 200;
        res = behB - behA;
      }
      return this.sortDirection === 'desc' ? -res : res;
    });

    this.applyFilter();
  }

  // --- Search & Filter ---
  applyFilter(): void {
    let result = [...this.students];

    // Filter by grade level mode
    if (this.filterMode === 'excellent') {
      result = result.filter((st) => st.gradeLevel === 'ดีเลิศ');
    } else if (this.filterMode === 'very-good') {
      result = result.filter((st) => st.gradeLevel === 'ดีมาก');
    } else if (this.filterMode === 'good') {
      result = result.filter((st) => st.gradeLevel === 'ดี');
    } else if (this.filterMode === 'fair') {
      result = result.filter((st) => st.gradeLevel === 'พอใช้');
    } else if (this.filterMode === 'poor') {
      result = result.filter((st) => st.gradeLevel === 'ไม่พอใช้');
    }

    // Filter by search query
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (q) {
      result = result.filter((st) => {
        const combined = `${st.student_code} ${st.rank_name} ${st.first_name} ${st.last_name} ${st.affiliation} ${st.behaviorScore ?? ''} ${st.gpa} ${st.gradeLevel} ${st.rank}`.toLowerCase();
        return combined.includes(q);
      });
    }

    this.filteredStudents = result;
  }

  // --- Save to Backend ---
  saveScores(): void {
    if (!this.selectedBatch || this.students.length === 0) return;
    if (this.isSaving) return;

    // 1. ตรวจสอบค่าว่าง (ห้ามปล่อยว่าง)
    const hasEmptyScore = this.students.some((st) => {
      const train = st.trainingTimeScore;
      const exam = st.examTimeScore;
      return (
        train === null ||
        train === undefined ||
        String(train).trim() === '' ||
        exam === null ||
        exam === undefined ||
        String(exam).trim() === ''
      );
    });

    if (hasEmptyScore) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกเปอร์เซ็นต์เวลาให้ครบถ้วน',
        text: 'กรุณากรอกเปอร์เซ็นต์เวลาให้ครบถ้วน',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    // 2. ตรวจสอบเปอร์เซ็นต์เกิน 100%
    const hasOverScore = this.students.some((st) => {
      const train = Number(st.trainingTimeScore);
      const exam = Number(st.examTimeScore);
      return train > 100 || exam > 100;
    });

    if (hasOverScore) {
      Swal.fire({
        icon: 'warning',
        title: 'เปอร์เซ็นต์เวลาต้องไม่เกิน 100%',
        text: 'เปอร์เซ็นต์เวลาต้องไม่เกิน 100%',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    // 3. ตรวจสอบเปอร์เซ็นต์น้อยกว่า 0% หรือไม่ใช่ตัวเลข
    const hasNegativeOrNaN = this.students.some((st) => {
      const train = Number(st.trainingTimeScore);
      const exam = Number(st.examTimeScore);
      return isNaN(train) || isNaN(exam) || train < 0 || exam < 0;
    });

    if (hasNegativeOrNaN) {
      Swal.fire({
        icon: 'warning',
        title: 'รูปแบบตัวเลขไม่ถูกต้อง',
        text: 'รูปแบบตัวเลขไม่ถูกต้อง',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    // 4. ตรวจสอบคะแนนความประพฤติ (0-200 คะแนน)
    const hasInvalidBehavior = this.students.some((st) => {
      const b = st.behaviorScore;
      if (b === null || b === undefined || String(b).trim() === '') return false;
      const num = Number(b);
      return isNaN(num) || num > 200 || num < 0;
    });

    if (hasInvalidBehavior) {
      Swal.fire({
        icon: 'warning',
        title: 'คะแนนความประพฤติต้องอยู่ระหว่าง 0 ถึง 200',
        text: 'กรุณาตรวจสอบคะแนนความประพฤติของนักเรียนให้อยู่ระหว่าง 0 - 200 คะแนน',
        confirmButtonColor: '#8e44ad',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();
    const batchId = Number(this.selectedBatch);

    const payload = {
      batch_id: batchId,
      scores: this.students.map((st) => ({
        student_id: st.student_id,
        training_time_score: Number(st.trainingTimeScore),
        exam_time_score: Number(st.examTimeScore),
        behavior_score:
          st.behaviorScore !== null &&
          st.behaviorScore !== undefined &&
          String(st.behaviorScore).trim() !== ''
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
          this.hasUnsavedChanges = false;
          this.students.forEach((s) => (s.isModified = false));
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ',
            text: `บันทึกข้อมูลเวลาการฝึกอบรม เวลาสอบ และคะแนนความประพฤตินักเรียนจำนวน ${this.students.length} นาย เรียบร้อยแล้ว`,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#1e3a8a',
            timer: 2000,
            timerProgressBar: true,
          });
        },
        error: (err: any) => {
          console.error('Failed to save time scores', err);
          this.cdr.detectChanges();
          const errorMsg =
            err.error?.message ||
            'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: errorMsg,
            confirmButtonColor: '#d33',
          });
        },
      });
  }

  // --- Export Excel (ตรงตามใน Image 1 & Image 2) ---
  async exportExcel(): Promise<void> {
    if (this.students.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'ไม่มีข้อมูลนักเรียนให้ส่งออก Excel',
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('เกรดเฉลี่ยและเวลาฝึกอบรม');

    const courseName = this.getSelectedCourseName();
    const batchName = this.getSelectedBatchName();

    // Title Row
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `ตารางสรุปเกรดเฉลี่ย เวลาการฝึกอบรม และคะแนนความประพฤติ - ${courseName} ${batchName}`;
    titleCell.font = { name: 'Sarabun', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Subtitle Row
    worksheet.mergeCells('A2:J2');
    const subCell = worksheet.getCell('A2');
    subCell.value = `พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')} | จำนวนนักเรียนทั้งหมด: ${this.students.length} นาย | เกรดเฉลี่ยรวมของรุ่น: ${this.averageGpa}`;
    subCell.font = { name: 'Sarabun', size: 10, italic: true };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]); // Blank row

    // Table Header Level 1
    const headerRow1 = worksheet.addRow([
      'ลำดับ',
      'รหัสประจำตัว',
      'ยศ - ชื่อ - นามสกุล',
      'สังกัด',
      'เวลาคิดเป็นร้อยละ',
      '',
      'คะแนนความประพฤติ (เต็ม 200)',
      'คะแนนเฉลี่ยสะสม',
      'เกณฑ์ที่ได้',
      'ลำดับที่ได้',
    ]);
    worksheet.mergeCells('E4:F4');

    // Table Header Level 2
    const headerRow2 = worksheet.addRow([
      '',
      '',
      '',
      '',
      'เวลาในการฝึกอบรม (%)',
      'เวลาในการสอบ (%)',
      '',
      '',
      '',
      '',
    ]);
    worksheet.mergeCells('A4:A5');
    worksheet.mergeCells('B4:B5');
    worksheet.mergeCells('C4:C5');
    worksheet.mergeCells('D4:D5');
    worksheet.mergeCells('G4:G5');
    worksheet.mergeCells('H4:H5');
    worksheet.mergeCells('I4:I5');
    worksheet.mergeCells('J4:J5');

    // Style Headers
    [headerRow1, headerRow2].forEach((row) => {
      row.eachCell((cell, colNumber) => {
        let bgColor = 'FFE8F0FE'; // Standard blue tint
        let textColor = 'FF1E3A8A';

        // คะแนนเฉลี่ยสะสม: สีส้มอมชมพูเหมือนเอ็กเซล
        if (colNumber === 8) {
          bgColor = 'FFFADBD8';
          textColor = 'FF922B21';
        } else if (colNumber === 9 || colNumber === 10) {
          bgColor = 'FFFEF9E7';
          textColor = 'FF7D6608';
        }

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.font = { name: 'Sarabun', size: 10.5, bold: true, color: { argb: textColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Data Rows
    this.students.forEach((st, idx) => {
      const row = worksheet.addRow([
        idx + 1,
        st.student_code,
        `${st.rank_name} ${st.first_name} ${st.last_name}`.trim(),
        st.affiliation || '-',
        st.trainingTimeScore !== null ? Number(st.trainingTimeScore) : 100,
        st.examTimeScore !== null ? Number(st.examTimeScore) : 100,
        st.behaviorScore !== null ? Number(st.behaviorScore) : 200,
        st.gpa !== '-' ? Number(st.gpa) : '-',
        st.gradeLevel,
        st.rank ? st.rank : '-',
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Sarabun', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 9 || colNumber === 10) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 3) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        } else if (colNumber === 8) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Sarabun', size: 10, bold: true };
          if (typeof cell.value === 'number') cell.numFmt = '0.00';
        }
      });
    });

    // Set Column Widths
    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 14;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 18;
    worksheet.getColumn(5).width = 22;
    worksheet.getColumn(6).width = 22;
    worksheet.getColumn(7).width = 20;
    worksheet.getColumn(8).width = 18;
    worksheet.getColumn(9).width = 16;
    worksheet.getColumn(10).width = 14;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `เกรดเฉลี่ยและเวลาฝึกอบรม_${batchName || 'รุ่น'}.xlsx`);
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}
