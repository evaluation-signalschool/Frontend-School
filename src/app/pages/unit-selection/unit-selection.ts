import { Component, OnInit, ChangeDetectorRef, inject, ViewChild, ElementRef, HostListener, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CourseService, CourseGroup } from '../../services/course.service';
import { DropdownService } from '../../services/dropdown.service';
import { ScoreService } from '../../services/score.service';
import { StudentService } from '../../services/student.service';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

export interface UnitQuota {
  id: string;
  name: string;
  shortName?: string;
  category?: string;
  totalQuota: number;
  description?: string;
}

export interface SubjectDetail {
  id: number;
  name: string;
  max_score: number;
  max_score_formatted?: string;
  is_su?: boolean;
}

export interface SubjectScoreDetail {
  groupId: number;
  groupName: string;
  isMerged?: boolean;
  subjectsCount?: number;
  sum_raw_score?: number;
  sum_raw_score_formatted?: string;
  avg_raw_score?: number;
  avg_raw_score_formatted?: string;
  max_score?: number;
  max_score_formatted?: string;
  raw_score: number;
  raw_score_formatted: string;
  credit: number;
  credit_formatted?: string;
  weighted_score: number;
  weighted_score_formatted: string;
  max_weighted_score?: number;
  max_weighted_score_formatted?: string;
  subject_scores?: Record<
    number,
    {
      id: number;
      name: string;
      raw_score: number;
      raw_score_formatted: string;
      max_score: number;
      max_score_formatted?: string;
    }
  >;
}

export interface SubjectGroupHeader {
  groupId: number;
  groupName: string;
  credit: number;
  displayName: string;
  subjectNames?: string;
  fullName?: string;
  isMerged: boolean;
  subjectsCount: number;
  subjects?: SubjectDetail[];
  sum_max_score?: number;
  avg_max_score?: number;
  group_max_score?: number;
  group_max_score_formatted?: string;
  group_max_weighted?: number;
  group_max_weighted_formatted?: string;
}

export interface StudentUnitAssignment {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  full_name: string;
  gpa?: string;
  rank: number;
  officialRank: number | null;
  selectionRank?: number | null;
  originalAffiliation: string;
  subject_raw_scores?: Record<number, number>;
  group_scores: Record<number, SubjectScoreDetail>;
  total_weighted_score: number;
  total_weighted_score_formatted: string;
  behavior_score: number;
  behavior_score_formatted: string;
  academic_score_80: number;
  academic_score_80_formatted: string;
  behavior_score_20: number;
  behavior_score_20_formatted: string;
  final_score: number;
  final_score_formatted: string;
  selectedUnitId: string | null;
  selectedUnitName: string | null;
  assignedAt?: string | null;
  notes?: string;
}

const STORAGE_KEY_PREFIX_UNITS = 'units_list_batch_';
const STORAGE_KEY_PREFIX_ASSIGNMENTS = 'unit_assignments_batch_';
const STORAGE_KEY_PREFIX_CONFIG = 'unit_selection_config_batch_';
const STORAGE_KEY_LAST_SELECTION = 'unit_selection_last_selection';

@Component({
  selector: 'app-unit-selection',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './unit-selection.html',
  styleUrl: './unit-selection.scss',
})
export class UnitSelection implements OnInit, AfterViewInit, OnDestroy {
  private courseService = inject(CourseService);
  private dropdownService = inject(DropdownService);
  private scoreService = inject(ScoreService);
  private studentService = inject(StudentService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  // Fullscreen & Horizontal Scrolling References
  @ViewChild('tableContainer') tableContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('topScrollbarContainer') topScrollContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('selectionTable') selectionTableRef?: ElementRef<HTMLTableElement>;

  isFullscreen: boolean = false;
  tableScrollWidth: number = 3600;
  private isSyncingScroll: boolean = false;
  private tableResizeObserver?: ResizeObserver;

  // Filter States
  courses: { id: any; group_name: string }[] = [];
  selectedCourse: any = '';
  batches: { id: any; name: string }[] = [];
  selectedBatch: any = '';

  // Data States
  courseGroups: CourseGroup[] = [];
  students: StudentUnitAssignment[] = [];
  units: UnitQuota[] = [];
  isBatchEnabledForUnitSelection: boolean = true;
  subjectGroups: SubjectGroupHeader[] = [];
  totalMaxWeighted: number = 0;
  totalMaxWeightedFormatted: string = '0.0000';
  totalCredits: number = 0;
  maxBehaviorScore: number = 0;
  maxAcademic80: number = 0;
  maxAcademic80Formatted: string = '0.0000';
  maxBehavior20: number = 0;
  maxBehavior20Formatted: string = '0.0000';
  maxFinalScore: number = 0;
  maxFinalScoreFormatted: string = '0.0000';

  private resetMaxScoreSummary(): void {
    this.totalMaxWeighted = 0;
    this.totalMaxWeightedFormatted = '0.0000';
    this.totalCredits = 0;
    this.maxBehaviorScore = 0;
    this.maxAcademic80 = 0;
    this.maxAcademic80Formatted = '0.0000';
    this.maxBehavior20 = 0;
    this.maxBehavior20Formatted = '0.0000';
    this.maxFinalScore = 0;
    this.maxFinalScoreFormatted = '0.0000';
  }

  // UI States
  isLoadingCourses: boolean = false;
  isLoadingStudents: boolean = false;
  isSaving: boolean = false;
  hasUnsavedChanges: boolean = false;

  // Search & Filter
  searchQuery: string = '';
  filterStatus: 'all' | 'assigned' | 'unassigned' | 'in_quota' | 'pre_assigned' = 'all';
  filterUnitId: string = 'all';
  sortBy: string = 'rank';
  sortDirection: 'asc' | 'desc' = 'asc';

  // โควตาผู้มีสิทธิ์เลือกหน่วย:
  // 'technician' = เลขที่ 16-30 เลือกหน่วย (15 คนหลัง) + เลขที่ 1-15 สังกัดเดิม (15 คนแรก)
  // 'all' = ทุกคนมีสิทธิ์เลือก (แบบ นนส.)
  // 'custom' = กำหนดช่วงเลขที่เอง
  quotaMode: 'technician' | 'all' | 'custom' = 'technician';
  quotaStartCode: number = 16;
  quotaEndCode: number = 30;
  selectionQuotaCount: number | null = 15;

  // Modal State for Unit Management
  isUnitModalOpen: boolean = false;
  editingUnit: UnitQuota | null = null;
  unitForm: {
    name: string;
    shortName: string;
    category: string;
    totalQuota: number;
    description: string;
  } = {
    name: '',
    shortName: '',
    category: 'หน่วยกำลังรบ',
    totalQuota: 5,
    description: '',
  };

  // Print Mode State ('coordination' = ใบประสานงานส่งให้อีกฝ่ายไปให้ นร. เลือกและลงลายมือชื่อ | 'final' = ใบสรุปผลเมื่อกรอกเสร็จ)
  printMode: 'coordination' | 'final' = 'coordination';

  get batchName(): string {
    const b = this.batches.find((b) => Number(b.id) === Number(this.selectedBatch));
    return b ? b.name : (this.selectedBatch ? `รุ่นที่ ${this.selectedBatch}` : '');
  }

  get courseName(): string {
    const c = this.courses.find((c) => String(c.id) === String(this.selectedCourse));
    return c ? c.group_name : '';
  }

  get isTechnicianCourse(): boolean {
    const name = (this.courseName || '').toLowerCase();
    const batch = (this.batchName || '').toLowerCase();
    return name.includes('ช่าง') || name.includes('อิเล็ก') || name.includes('electronic') ||
           batch.includes('ช่าง') || batch.includes('อิเล็ก');
  }

  parseStudentCode(code: any): number | null {
    if (code === undefined || code === null) return null;
    const match = String(code).trim().match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  get isQuotaActive(): boolean {
    return this.quotaMode !== 'all';
  }

  isStudentInSelectionQuota(student: Partial<StudentUnitAssignment>): boolean {
    if (this.quotaMode === 'all') return true;

    if (this.quotaMode === 'technician') {
      // เลือกหน่วยไม่ใช่ 15 คนแรก แต่เป็น 15 คนหลังตั้งแต่เลขที่ 16-30
      const codeNum = this.parseStudentCode(student.student_code);
      if (codeNum !== null) {
        return codeNum >= 16 && codeNum <= 30;
      }
      // กรณีไม่มีเลขที่ ดูจากลำดับผลการเรียน 15 คนหลัง
      const total = this.students.length || 30;
      const threshold = total > 15 ? total - 15 : 15;
      return (student.rank || 0) > threshold;
    }

    if (this.quotaMode === 'custom') {
      const codeNum = this.parseStudentCode(student.student_code);
      if (codeNum !== null) {
        const start = this.quotaStartCode || 16;
        const end = this.quotaEndCode || 30;
        return codeNum >= start && codeNum <= end;
      }
      return (student.rank || 0) > 15;
    }

    return true;
  }

  get selectionQuotaStudents(): StudentUnitAssignment[] {
    if (!this.isQuotaActive) return this.students;
    return this.students.filter((s) => this.isStudentInSelectionQuota(s));
  }

  get preAssignedStudents(): StudentUnitAssignment[] {
    if (!this.isQuotaActive) return [];
    return this.students.filter((s) => !this.isStudentInSelectionQuota(s));
  }

  get selectionQuotaAssignedCount(): number {
    return this.selectionQuotaStudents.filter(
      (s) => s.selectedUnitName && s.selectedUnitName.trim() !== ''
    ).length;
  }

  get selectionQuotaUnassignedCount(): number {
    return this.selectionQuotaStudents.filter(
      (s) => !s.selectedUnitName || s.selectedUnitName.trim() === ''
    ).length;
  }

  get preAssignedFilledCount(): number {
    return this.preAssignedStudents.filter(
      (s) => (s.selectedUnitName && s.selectedUnitName.trim() !== '') || (s.originalAffiliation && s.originalAffiliation !== '-')
    ).length;
  }

  get unassignedCount(): number {
    if (this.isQuotaActive) {
      return this.selectionQuotaUnassignedCount;
    }
    return this.students.filter((s) => !s.selectedUnitName || s.selectedUnitName.trim() === '').length;
  }

  calculateSelectionRanks(): void {
    if (!this.students || this.students.length === 0) return;

    if (!this.isQuotaActive) {
      this.students.forEach((s, idx) => {
        s.selectionRank = s.rank || (idx + 1);
      });
      return;
    }

    // 1. แยกกลุ่มเลือกหน่วย (เลขที่ 16-30)
    const selectionGroup = this.students.filter((s) => this.isStudentInSelectionQuota(s));

    // เรียงตามคะแนนสุทธิ final_score จากมากไปน้อย เพื่อหาว่าใน 15 คนนี้ใครได้เลือกลำดับที่ 1 ถึง 15
    selectionGroup.sort((a, b) => {
      const diff = (b.final_score || 0) - (a.final_score || 0);
      if (Math.abs(diff) > 0.000001) return diff;
      const wDiff = (b.total_weighted_score || 0) - (a.total_weighted_score || 0);
      if (Math.abs(wDiff) > 0.000001) return wDiff;
      return (b.behavior_score || 0) - (a.behavior_score || 0);
    });

    // กำหนดลำดับสิทธิ์การเลือกหน่วย 1 ถึง 15 ใน 15 คนนี้
    selectionGroup.forEach((st, idx) => {
      st.selectionRank = idx + 1;
    });

    // 2. กลุ่มสังกัดเดิม (เลขที่ 1-15)
    const preAssignedGroup = this.students.filter((s) => !this.isStudentInSelectionQuota(s));
    preAssignedGroup.forEach((st) => {
      st.selectionRank = null; // สังกัดเดิม ไม่ต้องเลือกหน่วย
      // ดึงสังกัดในข้อมูลนักเรียนมาแสดงเป็นหน่วยบรรจุ
      const aff = (st.originalAffiliation && st.originalAffiliation !== '-') ? st.originalAffiliation.trim() : '';
      st.selectedUnitName = aff || 'สังกัดเดิม';
      st.selectedUnitId = 'orig_' + st.student_id;
      st.assignedAt = 'สังกัดเดิม';
    });
  }

  get printCoordinationStudents(): StudentUnitAssignment[] {
    if (!this.isQuotaActive) return this.students;
    // กลุ่มเลือกหน่วย (16-30) เรียงตามลำดับที่ได้เลือก 1 ถึง 15 (ใครได้เลือกลำดับที่ 1 ขึ้นก่อน)
    const quota = [...this.selectionQuotaStudents].sort(
      (a, b) => (a.selectionRank || 999) - (b.selectionRank || 999)
    );
    // กลุ่มสังกัดเดิม (1-15) เรียงตามเลขที่ 1 ถึง 15 ดึงสังกัดจากข้อมูลนักเรียน
    const pre = [...this.preAssignedStudents].sort((a, b) => {
      const cA = this.parseStudentCode(a.student_code) || 0;
      const cB = this.parseStudentCode(b.student_code) || 0;
      return cA - cB;
    });
    return [...quota, ...pre];
  }

  printCoordinationSheet(): void {
    this.calculateSelectionRanks();
    this.printMode = 'coordination';
    this.cdr.detectChanges();
    setTimeout(() => {
      window.print();
    }, 150);
  }

  printFinalSheet(): void {
    this.printMode = 'final';
    this.cdr.detectChanges();
    setTimeout(() => {
      window.print();
    }, 150);
  }

  ngOnInit(): void {
    let paramCourse: any = null;
    let paramBatch: any = null;

    this.route.queryParams.subscribe((params) => {
      if (params['courseId']) paramCourse = params['courseId'];
      if (params['batchId']) paramBatch = Number(params['batchId']);
    });

    if (paramCourse) this.selectedCourse = paramCourse;
    if (paramBatch) this.selectedBatch = paramBatch;

    if (!this.selectedCourse && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_LAST_SELECTION);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.courseId) this.selectedCourse = parsed.courseId;
          if (parsed.batchId) this.selectedBatch = Number(parsed.batchId);
        }
      } catch (_) {}
    }

    this.loadCourses();
  }

  ngAfterViewInit(): void {
    this.tableScrollWidth = this.computeEstimatedTableWidth();
    this.syncTopScrollbarWidth();
    this.initTableResizeObserver();
  }

  ngOnDestroy(): void {
    this.tableResizeObserver?.disconnect();
    this.stopContinuousScroll();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncTopScrollbarWidth();
  }

  // --- การจัดการแถบเลื่อนแนวนอน และโหมดเต็มจอ (Horizontal Scrolling & Fullscreen) ---
  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        }
      } catch (_) {}
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (_) {}
    }
    this.cdr.detectChanges();
    setTimeout(() => {
      this.syncTopScrollbarWidth();
    }, 150);
  }

  exitFullscreen(): void {
    this.isFullscreen = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (_) {}
    this.cdr.detectChanges();
    setTimeout(() => {
      this.syncTopScrollbarWidth();
    }, 150);
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (!document.fullscreenElement && this.isFullscreen) {
      this.isFullscreen = false;
      this.cdr.detectChanges();
      this.syncTopScrollbarWidth();
    }
  }

  private scrollInterval: any = null;

  scrollTable(direction: 'start' | 'left' | 'right' | 'mid' | 'end', customAmount?: number): void {
    const el = this.tableContainerRef?.nativeElement;
    if (!el) return;

    // คำนวณระยะการเลื่อนต่อครั้ง ให้เลื่อนเยอะขึ้นแบบเต็มจอ (950px หรือ 85% ของหน้าจอ)
    const step = customAmount || Math.max(950, Math.floor(el.clientWidth * 0.85));

    if (direction === 'start') {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (direction === 'end') {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    } else if (direction === 'mid') {
      const mid = Math.floor((el.scrollWidth - el.clientWidth) / 2);
      el.scrollTo({ left: mid, behavior: 'smooth' });
    } else if (direction === 'left') {
      el.scrollBy({ left: -step, behavior: 'smooth' });
    } else if (direction === 'right') {
      el.scrollBy({ left: step, behavior: 'smooth' });
    }
  }

  startContinuousScroll(direction: 'left' | 'right'): void {
    this.stopContinuousScroll();
    // ถ้ากดค้างไว้ เลื่อนต่อเนื่องรวดเร็วทีละ 300px ทุก 80ms
    this.scrollInterval = setInterval(() => {
      const el = this.tableContainerRef?.nativeElement;
      if (!el) return;
      const step = direction === 'left' ? -300 : 300;
      el.scrollBy({ left: step, behavior: 'auto' });
    }, 80);
  }

  stopContinuousScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
  }

  onTableScroll(): void {
    if (this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    const topEl = this.topScrollContainerRef?.nativeElement;
    const tableEl = this.tableContainerRef?.nativeElement;
    if (topEl && tableEl) {
      const topMax = topEl.scrollWidth - topEl.clientWidth;
      const tableMax = tableEl.scrollWidth - tableEl.clientWidth;
      if (topMax > 0 && tableMax > 0) {
        const ratio = tableEl.scrollLeft / tableMax;
        topEl.scrollLeft = Math.round(ratio * topMax);
      } else {
        topEl.scrollLeft = tableEl.scrollLeft;
      }
    }
    requestAnimationFrame(() => {
      this.isSyncingScroll = false;
    });
  }

  onTopScroll(): void {
    if (this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    const topEl = this.topScrollContainerRef?.nativeElement;
    const tableEl = this.tableContainerRef?.nativeElement;
    if (topEl && tableEl) {
      const topMax = topEl.scrollWidth - topEl.clientWidth;
      const tableMax = tableEl.scrollWidth - tableEl.clientWidth;
      if (topMax > 0 && tableMax > 0) {
        const ratio = topEl.scrollLeft / topMax;
        tableEl.scrollLeft = Math.round(ratio * tableMax);
      } else {
        tableEl.scrollLeft = topEl.scrollLeft;
      }
    }
    requestAnimationFrame(() => {
      this.isSyncingScroll = false;
    });
  }

  get totalTableColumnsCount(): number {
    let count = 4; // rank, code, name, orig
    this.subjectGroups.forEach((g) => {
      count += (g.isMerged && g.subjects && g.subjects.length > 1) ? (g.subjects.length + 1) : 2;
    });
    count += 5; // total_w, behavior, acad_80, beh_20, final_score
    count += 5; // unit, time, notes, status, actions
    return count;
  }

  computeEstimatedTableWidth(): number {
    let dynamicColsCount = 0;
    this.subjectGroups.forEach((g) => {
      if (g.isMerged && g.subjects && g.subjects.length > 1) {
        dynamicColsCount += g.subjects.length + 1;
      } else {
        dynamicColsCount += 2;
      }
    });
    // 4 คอลัมน์แรก (ลำดับ, เลขที่, ยศ-ชื่อ, สังกัดเดิม): ~520px
    // วิชา: ~115px ต่อคอลัมน์ย่อย
    // ส่วนสรุปคะแนนรวมท้ายวิชา (5 คอลัมน์): ~850px
    // ส่วนเลือกหน่วยบรรจุ (5 คอลัมน์): ~650px
    // ระยะเผื่อขอบ: ~250px
    const baseColsWidth = 520;
    const subjectsWidth = dynamicColsCount * 115;
    const summaryColsWidth = 850;
    const unitColsWidth = 650;
    const safetyMargin = 250;
    return Math.max(baseColsWidth + subjectsWidth + summaryColsWidth + unitColsWidth + safetyMargin, 3600);
  }

  syncTopScrollbarWidth(): void {
    if (typeof window === 'undefined') return;

    const measure = () => {
      const container = this.tableContainerRef?.nativeElement;
      const table = (this.selectionTableRef?.nativeElement || container?.querySelector('table')) as HTMLElement | null;

      let measuredWidth = 0;
      if (table) {
        measuredWidth = Math.max(
          table.scrollWidth || 0,
          table.offsetWidth || 0,
          Math.round(table.getBoundingClientRect().width || 0)
        );
      }
      if (container) {
        measuredWidth = Math.max(measuredWidth, container.scrollWidth || 0);
      }

      const estimated = this.computeEstimatedTableWidth();
      const finalWidth = Math.max(measuredWidth, estimated);

      if (finalWidth > 0 && Math.abs(finalWidth - this.tableScrollWidth) > 5) {
        this.tableScrollWidth = finalWidth;
        this.cdr.detectChanges();
      }
    };

    measure();
    requestAnimationFrame(measure);
    setTimeout(measure, 50);
    setTimeout(measure, 150);
    setTimeout(measure, 400);
    setTimeout(measure, 1000);
  }

  initTableResizeObserver(): void {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;

    this.tableResizeObserver?.disconnect();
    this.tableResizeObserver = new ResizeObserver(() => {
      this.syncTopScrollbarWidth();
    });

    const el = this.tableContainerRef?.nativeElement;
    if (el) {
      this.tableResizeObserver.observe(el);
      const table = el.querySelector('table');
      if (table) {
        this.tableResizeObserver.observe(table);
      }
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/admin']);
    }
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data;
          this.courses = res.data.map((cg: CourseGroup) => ({
            id: cg.batches?.[0]?.course_id || cg.course_name,
            group_name: cg.course_name,
          }));

          if (this.selectedCourse) {
            this.onCourseChange(false);
          }
          this.cdr.detectChanges();
        }
        this.isLoadingCourses = false;
      },
      error: (err) => {
        console.error('Failed to load courses:', err);
        this.isLoadingCourses = false;
        this.cdr.detectChanges();
      },
    });
  }

  onCourseChange(resetBatch: boolean = true): void {
    if (resetBatch) {
      this.selectedBatch = '';
      this.students = [];
      this.units = [];
      this.subjectGroups = [];
      this.resetMaxScoreSummary();
    }
    this.batches = [];

    if (!this.selectedCourse) {
      this.students = [];
      this.units = [];
      this.subjectGroups = [];
      this.resetMaxScoreSummary();
      this.saveLastSelection();
      this.cdr.detectChanges();
      return;
    }

    const courseGroup = this.courseGroups.find(
      (c) =>
        String(c.batches?.[0]?.course_id) === String(this.selectedCourse) ||
        c.course_name === this.selectedCourse
    );

    const onBatchesReady = () => {
      this.saveLastSelection();
      if (this.selectedBatch) {
        const batchExists = this.batches.some(
          (b) => Number(b.id) === Number(this.selectedBatch)
        );
        if (batchExists) {
          this.onBatchChange();
        } else {
          this.selectedBatch = '';
          this.students = [];
          this.units = [];
          this.subjectGroups = [];
          this.resetMaxScoreSummary();
        }
      }
      this.cdr.detectChanges();
    };

    if (courseGroup && courseGroup.batches && courseGroup.batches.length > 0) {
      this.batches = courseGroup.batches.map((b) => ({
        id: b.batch_id,
        name: b.batch_name || `รุ่นที่ ${b.batch_id}`,
      }));
      onBatchesReady();
    } else {
      this.dropdownService.getBatches(this.selectedCourse).subscribe({
        next: (res) => {
          if (res?.success && res.data) {
            this.batches = res.data.map((b: any) => ({
              id: b.id || b.batch_id,
              name: b.name || b.batch_name || `รุ่นที่ ${b.id || b.batch_id}`,
            }));
            onBatchesReady();
          }
        },
        error: (err) => {
          console.error('Failed to load batches:', err);
          this.cdr.detectChanges();
        },
      });
    }
  }

  onBatchChange(): void {
    this.students = [];
    this.subjectGroups = [];
    this.resetMaxScoreSummary();

    if (!this.selectedBatch) {
      this.units = [];
      this.saveLastSelection();
      this.cdr.detectChanges();
      return;
    }

    this.saveLastSelection();
    this.loadBatchUnits(Number(this.selectedBatch));
    this.loadBatchStudents(Number(this.selectedBatch));
  }

  private saveLastSelection(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEY_LAST_SELECTION,
          JSON.stringify({
            courseId: this.selectedCourse,
            batchId: this.selectedBatch,
          })
        );
      } catch (_) {}
    }
  }

  // --- จัดการข้อมูลหน่วย & โควตา (Units & Quota Management) ---
  loadBatchUnits(batchId: number): void {
    if (typeof window !== 'undefined') {
      try {
        const savedUnits = localStorage.getItem(STORAGE_KEY_PREFIX_UNITS + batchId);
        if (savedUnits) {
          this.units = JSON.parse(savedUnits);
        } else {
          // ตั้งค่าเริ่มต้นของหน่วยบรรจุ หากยังไม่มีการกำหนด
          this.units = this.getDefaultUnitsPreset();
          this.saveUnitsToStorage(batchId);
        }

        const savedConfig = localStorage.getItem(STORAGE_KEY_PREFIX_CONFIG + batchId);
        if (savedConfig) {
          const cfg = JSON.parse(savedConfig);
          this.isBatchEnabledForUnitSelection = cfg.enabled !== false;
          this.quotaMode = cfg.quotaMode || (this.isTechnicianCourse ? 'technician' : 'all');
          this.quotaStartCode = cfg.quotaStartCode !== undefined ? cfg.quotaStartCode : 16;
          this.quotaEndCode = cfg.quotaEndCode !== undefined ? cfg.quotaEndCode : 30;
          this.selectionQuotaCount = cfg.selectionQuotaCount !== undefined ? cfg.selectionQuotaCount : 15;
        } else {
          this.isBatchEnabledForUnitSelection = true;
          this.quotaMode = this.isTechnicianCourse ? 'technician' : 'all';
          this.quotaStartCode = 16;
          this.quotaEndCode = 30;
          this.selectionQuotaCount = 15;
        }
      } catch (e) {
        console.error('Error loading units:', e);
        this.units = this.getDefaultUnitsPreset();
      }
    }
  }

  private getDefaultUnitsPreset(): UnitQuota[] {
    return [
      { id: 'unit_1', name: 'กองพันทหารราบที่ 1 กรมทหารราบที่ 1 (ร.1 พัน.1)', shortName: 'ร.1 พัน.1', category: 'เหล่าทหารราบ', totalQuota: 5, description: 'กรุงเทพมหานคร' },
      { id: 'unit_2', name: 'กองพันทหารราบที่ 2 กรมทหารราบที่ 1 (ร.1 พัน.2)', shortName: 'ร.1 พัน.2', category: 'เหล่าทหารราบ', totalQuota: 5, description: 'กรุงเทพมหานคร' },
      { id: 'unit_3', name: 'กองพันทหารม้าที่ 4 กรมทหารม้าที่ 1 (ม.1 พัน.4)', shortName: 'ม.1 พัน.4', category: 'เหล่าทหารม้า', totalQuota: 4, description: 'สระบุรี' },
      { id: 'unit_4', name: 'กรมการสื่อสารทหาร (สส.ทหาร)', shortName: 'สส.ทหาร', category: 'เหล่าทหารสื่อสาร', totalQuota: 4, description: 'ดอนเมือง' },
      { id: 'unit_5', name: 'มณฑลทหารบกที่ 11 (มทบ.11)', shortName: 'มทบ.11', category: 'มณฑลทหารบก', totalQuota: 3, description: 'กรุงเทพมหานคร' },
      { id: 'unit_6', name: 'กรมการทหารช่าง (กช.)', shortName: 'กช.', category: 'เหล่าทหารช่าง', totalQuota: 3, description: 'ราชบุรี' },
    ];
  }

  saveUnitsToStorage(batchId?: number): void {
    const bId = batchId || Number(this.selectedBatch);
    if (!bId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX_UNITS + bId, JSON.stringify(this.units));
    } catch (_) {}
  }

  saveConfig(batchId?: number): void {
    const bId = batchId || Number(this.selectedBatch);
    if (!bId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY_PREFIX_CONFIG + bId,
        JSON.stringify({
          enabled: this.isBatchEnabledForUnitSelection,
          quotaMode: this.quotaMode,
          quotaStartCode: this.quotaStartCode,
          quotaEndCode: this.quotaEndCode,
          selectionQuotaCount: this.selectionQuotaCount,
        })
      );
    } catch (_) {}
  }

  toggleBatchEnabled(): void {
    this.isBatchEnabledForUnitSelection = !this.isBatchEnabledForUnitSelection;
    this.saveConfig();
  }

  setQuotaMode(mode: 'technician' | 'all' | 'custom'): void {
    this.quotaMode = mode;
    if (mode === 'technician') {
      this.quotaStartCode = 16;
      this.quotaEndCode = 30;
      this.selectionQuotaCount = 15;
      this.autoFillOriginalAffiliations();
    } else if (mode === 'all') {
      this.selectionQuotaCount = null;
    }
    this.calculateSelectionRanks();
    this.saveConfig();
    this.cdr.detectChanges();
  }

  setSelectionQuota(count: number | null): void {
    if (!count) {
      this.setQuotaMode('all');
    } else {
      this.setQuotaMode('technician');
    }
  }

  onQuotaRangeChange(): void {
    this.quotaMode = 'custom';
    const start = this.quotaStartCode || 1;
    const end = this.quotaEndCode || start;
    this.selectionQuotaCount = Math.max(0, end - start + 1);
    this.calculateSelectionRanks();
    this.saveConfig();
    this.cdr.detectChanges();
  }

  autoFillOriginalAffiliations(): void {
    let filled = 0;
    this.students.forEach((s) => {
      if (!this.isStudentInSelectionQuota(s)) {
        const aff = (s.originalAffiliation && s.originalAffiliation !== '-') ? s.originalAffiliation : '';
        if (aff && s.selectedUnitName !== aff) {
          s.selectedUnitName = aff;
          s.selectedUnitId = 'orig_' + s.student_id;
          s.assignedAt = 'สังกัดเดิม';
          filled++;
        }
      }
    });
    if (filled > 0) {
      this.hasUnsavedChanges = true;
    }
  }

  applyPreAssignedAffiliations(): void {
    if (this.quotaMode === 'all') {
      this.setQuotaMode('technician');
    }

    let count = 0;
    this.students.forEach((s) => {
      if (!this.isStudentInSelectionQuota(s)) {
        const aff = (s.originalAffiliation && s.originalAffiliation !== '-') ? s.originalAffiliation : '';
        if (aff) {
          s.selectedUnitName = aff;
          s.selectedUnitId = 'orig_' + s.student_id;
          s.assignedAt = 'สังกัดเดิม';
          count++;
        }
      }
    });

    this.calculateSelectionRanks();
    this.hasUnsavedChanges = true;
    this.saveConfig();
    this.cdr.detectChanges();

    const maxCode = Math.max(1, (this.quotaStartCode || 16) - 1);
    if (count > 0) {
      Swal.fire({
        icon: 'success',
        title: 'ดึงสังกัดเดิมสำเร็จ',
        text: `ดึงข้อมูลสังกัดเดิมจากข้อมูลนักเรียนมาแสดงเป็นหน่วยบรรจุให้ ${count} นายเรียบร้อยแล้ว`,
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'ข้อมูลสังกัดเดิมครบถ้วน',
        text: `นักเรียนกลุ่มเลขที่ 1 ถึง ${maxCode} มีข้อมูลสังกัดเดิมแสดงเรียบร้อยแล้ว`,
        timer: 1600,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    }
  }

  // --- โหลดข้อมูลนักเรียนและอันดับตามสูตรใหม่ ---
  loadBatchStudents(batchId: number): void {
    this.isLoadingStudents = true;
    this.hasUnsavedChanges = false;
    this.resetMaxScoreSummary();
    this.cdr.detectChanges();

    // ดึงข้อมูลการจัดอันดับสำหรับการเลือกลงหน่วยจาก Backend (สูตร: คะแนนดิบ*หน่วยกิต, รวม 80% + ประพฤติ 20% ทศนิยม 4 ตำแหน่ง)
    this.scoreService.getUnitSelectionRanking(batchId).subscribe({
      next: (res: any) => {
        if (res?.success && res.data && res.data.length > 0) {
          const rawGroups: SubjectGroupHeader[] = res.subjectGroups || [];
          this.subjectGroups = rawGroups.sort((a, b) =>
            (a.groupName || '').localeCompare(b.groupName || '', undefined, { numeric: true, sensitivity: 'base' })
          );
          this.totalMaxWeighted = res.summary?.total_max_weighted || 0;
          this.totalMaxWeightedFormatted = res.summary?.total_max_weighted_formatted || '0.0000';
          this.totalCredits = res.summary?.total_credit || 0;
          this.maxBehaviorScore = res.summary?.max_behavior_score || 200;
          this.maxAcademic80 = res.summary?.max_academic_80 || (this.totalMaxWeighted * 0.8);
          this.maxAcademic80Formatted = res.summary?.max_academic_80_formatted || (this.totalMaxWeighted * 0.8).toFixed(4);
          this.maxBehavior20 = res.summary?.max_behavior_20 || (this.maxBehaviorScore * 0.2);
          this.maxBehavior20Formatted = res.summary?.max_behavior_20_formatted || (this.maxBehaviorScore * 0.2).toFixed(4);
          this.maxFinalScore = res.summary?.max_final_score || (this.maxAcademic80 + this.maxBehavior20);
          this.maxFinalScoreFormatted = res.summary?.max_final_score_formatted || this.maxFinalScore.toFixed(4);
          this.tableScrollWidth = this.computeEstimatedTableWidth();
          this.processStudentAssignments(res.data, batchId);
        } else {
          // Fallback ถ้าไม่มีข้อมูล หรือยังไม่กรอกคะแนน
          this.subjectGroups = [];
          this.students = [];
          this.resetMaxScoreSummary();
          this.tableScrollWidth = this.computeEstimatedTableWidth();
        }

        this.isLoadingStudents = false;
        this.cdr.detectChanges();
        this.syncTopScrollbarWidth();
        this.initTableResizeObserver();
      },
      error: (err) => {
        console.warn('Failed to load unit selection ranking, falling back to standard ranking:', err);
        this.subjectGroups = [];
        this.students = [];
        this.resetMaxScoreSummary();
        this.tableScrollWidth = this.computeEstimatedTableWidth();
        this.scoreService.getBatchRanking(batchId).subscribe({
          next: (sRes: any) => {
            const list = sRes?.data || [];
            this.processStudentAssignments(list, batchId);
            if (list.length === 0) {
              this.subjectGroups = [];
              this.students = [];
              this.resetMaxScoreSummary();
            }
            this.tableScrollWidth = this.computeEstimatedTableWidth();
            this.isLoadingStudents = false;
            this.cdr.detectChanges();
            this.syncTopScrollbarWidth();
            this.initTableResizeObserver();
          },
          error: () => {
            this.subjectGroups = [];
            this.students = [];
            this.resetMaxScoreSummary();
            this.tableScrollWidth = this.computeEstimatedTableWidth();
            this.isLoadingStudents = false;
            this.cdr.detectChanges();
          },
        });
      },
    });
  }

  private processStudentAssignments(rawList: any[], batchId: number): void {
    let savedAssignments: Record<string | number, { unitId: string; unitName: string; assignedAt: string; notes?: string }> = {};

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX_ASSIGNMENTS + batchId);
        if (saved) savedAssignments = JSON.parse(saved);
      } catch (_) {}
    }

    if (this.isTechnicianCourse && !this.quotaMode) {
      this.quotaMode = 'technician';
      this.quotaStartCode = 16;
      this.quotaEndCode = 30;
      this.selectionQuotaCount = 15;
    }

    this.students = rawList.map((st: any, index: number) => {
      const sId = st.student_id || st.id;
      const rank = st.rank != null ? st.rank : (st.manualRank != null ? st.manualRank : (index + 1));
      const sCode = String(st.student_code || st.code || '');
      const rankName = st.rank_name || st.rank || '';
      const firstName = st.first_name || '';
      const lastName = st.last_name || '';
      const fullName = st.full_name || `${rankName} ${firstName} ${lastName}`.trim();
      const origAff = (st.affiliation && st.affiliation !== '-') ? String(st.affiliation).trim() : '';

      const savedItem = savedAssignments[sId] || savedAssignments[sCode];

      let selectedUnitId: string | null = null;
      let selectedUnitName: string | null = null;
      let assignedAt: string | null = null;
      let notes: string = '';

      // ตรวจสอบกลุ่มเลือกหน่วย (เลขที่ 16-30 คือกลุ่มเลือกหน่วย / เลขที่ 1-15 คือกลุ่มสังกัดเดิม)
      const isInQuota = this.isStudentInSelectionQuota({
        student_code: sCode,
        rank: rank,
      });

      if (savedItem && savedItem.unitName && savedItem.unitName.trim() !== '') {
        selectedUnitId = savedItem.unitId;
        selectedUnitName = savedItem.unitName;
        assignedAt = savedItem.assignedAt;
        notes = savedItem.notes || '';
      } else {
        if (!isInQuota) {
          // อยู่นอกกลุ่มเลือกหน่วย (เลขที่ 1-15 / กลุ่มสังกัดเดิม) -> ดึงสังกัดเดิมลงเป็นหน่วยบรรจุให้อัตโนมัติ
          selectedUnitId = 'orig_' + sId;
          selectedUnitName = (origAff && origAff !== '-') ? origAff : 'บรรจุสังกัดเดิม';
          assignedAt = 'บรรจุสังกัดเดิม';
        } else if (origAff) {
          // เช็คว่ามีหน่วยตรงกับสังกัดเดิมหรือไม่
          const matchedUnit = this.units.find((u) => u.name === origAff || u.shortName === origAff);
          if (matchedUnit) {
            selectedUnitId = matchedUnit.id;
            selectedUnitName = matchedUnit.name;
          }
        }
      }

      return {
        student_id: sId,
        student_code: sCode,
        rank_name: rankName,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        gpa: st.gpa != null ? Number(st.gpa).toFixed(2) : undefined,
        rank: rank,
        officialRank: rank,
        originalAffiliation: origAff || '-',
        subject_raw_scores: st.subject_raw_scores || {},
        group_scores: st.group_scores || {},
        total_weighted_score: Number(st.total_weighted_score) || 0,
        total_weighted_score_formatted: st.total_weighted_score_formatted || (Number(st.total_weighted_score) || 0).toFixed(4),
        behavior_score: Number(st.behavior_score) || 0,
        behavior_score_formatted: st.behavior_score_formatted || (Number(st.behavior_score) || 0).toFixed(4),
        academic_score_80: Number(st.academic_score_80) || 0,
        academic_score_80_formatted: st.academic_score_80_formatted || (Number(st.academic_score_80) || 0).toFixed(4),
        behavior_score_20: Number(st.behavior_score_20) || 0,
        behavior_score_20_formatted: st.behavior_score_20_formatted || (Number(st.behavior_score_20) || 0).toFixed(4),
        final_score: Number(st.final_score) || 0,
        final_score_formatted: st.final_score_formatted || (Number(st.final_score) || 0).toFixed(4),
        selectedUnitId: selectedUnitId,
        selectedUnitName: selectedUnitName,
        assignedAt: assignedAt,
        notes: notes,
      };
    });

    // เรียงตามลำดับอันดับที่คำนวณจากคะแนนรวมสุทธิ 1 ถึง N เสมอ
    this.students.sort((a, b) => (a.rank || 0) - (b.rank || 0));
    this.calculateSelectionRanks();
  }

  getStudentSubjectRaw(student: StudentUnitAssignment, groupId: number, subjectId: number): string {
    const grpScore = student.group_scores?.[groupId];
    if (grpScore?.subject_scores?.[subjectId]?.raw_score_formatted) {
      return grpScore.subject_scores[subjectId].raw_score_formatted;
    }
    if (student.subject_raw_scores && student.subject_raw_scores[subjectId] !== undefined) {
      return Number(student.subject_raw_scores[subjectId]).toFixed(4);
    }
    return '0.0000';
  }

  // --- คำนวณยอดโควตา (Quota Calculation) ---
  getAssignedCount(unitId: string): number {
    return this.students.filter((s) => s.selectedUnitId === unitId).length;
  }

  getRemainingQuota(unit: UnitQuota): number {
    return Math.max(0, unit.totalQuota - this.getAssignedCount(unit.id));
  }

  isUnitFull(unit: UnitQuota, currentStudentUnitId?: string | null): boolean {
    if (currentStudentUnitId === unit.id) return false; // หน่วยที่ตนเองเลือกอยู่ไม่ถือว่าเต็มสำหรับตนเอง
    return this.getRemainingQuota(unit) <= 0;
  }

  getTotalAvailableQuota(): number {
    return this.units.reduce((sum, u) => sum + u.totalQuota, 0);
  }

  getTotalAssignedCount(): number {
    return this.students.filter((s) => (s.selectedUnitName && s.selectedUnitName.trim() !== '') || s.selectedUnitId != null).length;
  }

  getTotalRemainingQuota(): number {
    return Math.max(0, this.getTotalAvailableQuota() - this.getTotalAssignedCount());
  }

  // --- กิจกรรมการกรอกหน่วยของนักเรียน ---
  onUnitNameChange(student: StudentUnitAssignment, name: string): void {
    const trimmed = (name || '').trim();
    student.selectedUnitName = trimmed ? trimmed : null;
    student.selectedUnitId = trimmed ? ('unit_' + student.student_id) : null;
    if (trimmed) {
      if (!student.assignedAt) {
        student.assignedAt = new Date().toLocaleString('th-TH');
      }
    } else {
      student.assignedAt = null;
    }
    this.hasUnsavedChanges = true;
    this.cdr.detectChanges();
  }

  getExistingUnitNames(): string[] {
    const set = new Set<string>();
    this.students.forEach((s) => {
      if (s.selectedUnitName && s.selectedUnitName.trim()) {
        set.add(s.selectedUnitName.trim());
      }
      if (s.originalAffiliation && s.originalAffiliation.trim() && s.originalAffiliation !== '-') {
        set.add(s.originalAffiliation.trim());
      }
    });
    return Array.from(set).sort();
  }

  onSelectUnit(student: StudentUnitAssignment, unitId: string): void {
    if (!unitId || unitId === 'null' || unitId === '') {
      student.selectedUnitId = null;
      student.selectedUnitName = null;
      student.assignedAt = null;
      this.hasUnsavedChanges = true;
      return;
    }

    const selectedUnit = this.units.find((u) => u.id === unitId);
    if (!selectedUnit) return;

    student.selectedUnitId = selectedUnit.id;
    student.selectedUnitName = selectedUnit.name;
    student.assignedAt = new Date().toLocaleString('th-TH');
    this.hasUnsavedChanges = true;
    this.cdr.detectChanges();
  }

  clearSelection(student: StudentUnitAssignment): void {
    student.selectedUnitId = null;
    student.selectedUnitName = null;
    student.assignedAt = null;
    this.hasUnsavedChanges = true;
    this.cdr.detectChanges();
  }

  // --- บันทึกข้อมูลการจัดสรรหน่วย ---
  saveAllAssignments(): void {
    if (!this.selectedBatch) return;

    this.isSaving = true;
    const batchId = Number(this.selectedBatch);
    const assignmentsMap: Record<string | number, any> = {};

    this.students.forEach((s) => {
      if (s.selectedUnitName && s.selectedUnitName.trim() !== '') {
        assignmentsMap[s.student_id] = {
          unitId: s.selectedUnitId || ('unit_' + s.student_id),
          unitName: s.selectedUnitName.trim(),
          assignedAt: s.assignedAt || new Date().toLocaleString('th-TH'),
          notes: s.notes || '',
        };
      }
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEY_PREFIX_ASSIGNMENTS + batchId,
          JSON.stringify(assignmentsMap)
        );
      } catch (e) {
        console.error('Storage error:', e);
      }
    }

    // ซิงค์บันทึกข้อมูลสังกัด (affiliation) ของนักเรียนลง Database จริงในตาราง students
    const batchAffiliations = this.students
      .filter((s) => s.selectedUnitName && s.selectedUnitName.trim() !== '')
      .map((s) => ({
        student_id: s.student_id,
        affiliation: s.selectedUnitName!.trim(),
      }));

    if (batchAffiliations.length === 0) {
      this.isSaving = false;
      this.hasUnsavedChanges = false;
      this.cdr.detectChanges();
      Swal.fire({
        icon: 'info',
        title: 'บันทึกเรียบร้อย',
        text: 'บันทึกการตั้งค่าแล้ว (ยังไม่มีการเลือกหน่วยบรรจุของนักเรียน)',
        timer: 1600,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
      return;
    }

    this.studentService.updateBatchAffiliations(batchAffiliations).subscribe({
      next: (res: any) => {
        // อัปเดต originalAffiliation ให้ตรงกับค่าที่บันทึก
        this.students.forEach((s) => {
          if (s.selectedUnitName && s.selectedUnitName.trim() !== '') {
            s.originalAffiliation = s.selectedUnitName.trim();
          }
        });
        this.isSaving = false;
        this.hasUnsavedChanges = false;
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'success',
          title: 'บันทึกข้อมูลเรียบร้อยแล้ว',
          text: `บันทึกหน่วยบรรจุและอัปเดตข้อมูลสังกัดลงฐานข้อมูลสำเร็จ (${batchAffiliations.length} นาย)`,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      },
      error: (err: any) => {
        console.error('Failed to sync affiliations to database via batch endpoint, trying fallback:', err);
        const individualPromises = batchAffiliations.map((item) =>
          this.studentService.updateStudent(item.student_id, { affiliation: item.affiliation }).toPromise()
        );

        Promise.all(individualPromises)
          .then(() => {
            this.students.forEach((s) => {
              if (s.selectedUnitName && s.selectedUnitName.trim() !== '') {
                s.originalAffiliation = s.selectedUnitName.trim();
              }
            });
            this.isSaving = false;
            this.hasUnsavedChanges = false;
            this.cdr.detectChanges();
            Swal.fire({
              icon: 'success',
              title: 'บันทึกข้อมูลเรียบร้อยแล้ว',
              text: `บันทึกข้อมูลและอัปเดตสังกัดของนักเรียนในฐานข้อมูลสำเร็จ (${batchAffiliations.length} นาย)`,
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
            });
          })
          .catch((fallbackErr) => {
            console.error('Fallback update error:', fallbackErr);
            this.isSaving = false;
            this.cdr.detectChanges();
            Swal.fire({
              icon: 'warning',
              title: 'บันทึกลงเบราว์เซอร์สำเร็จ แต่ซิงค์ฐานข้อมูลไม่สำเร็จ',
              text: fallbackErr?.error?.message || err?.error?.message || 'โปรดตรวจสอบสิทธิ์ผู้ดูแลระบบหรือการเชื่อมต่อฐานข้อมูล',
            });
          });
      },
    });
  }

  // --- Modal จัดการหน่วย & โควตา ---
  openAddUnitModal(): void {
    this.editingUnit = null;
    this.unitForm = {
      name: '',
      shortName: '',
      category: 'หน่วยกำลังรบ',
      totalQuota: 5,
      description: '',
    };
    this.isUnitModalOpen = true;
  }

  openEditUnitModal(unit: UnitQuota): void {
    this.editingUnit = unit;
    this.unitForm = {
      name: unit.name,
      shortName: unit.shortName || '',
      category: unit.category || 'หน่วยกำลังรบ',
      totalQuota: unit.totalQuota,
      description: unit.description || '',
    };
    this.isUnitModalOpen = true;
  }

  closeUnitModal(): void {
    this.isUnitModalOpen = false;
    this.editingUnit = null;
  }

  saveUnitForm(): void {
    if (!this.unitForm.name.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่อหน่วย', confirmButtonColor: '#0d9488' });
      return;
    }

    if (this.unitForm.totalQuota < 1) {
      Swal.fire({ icon: 'warning', title: 'จำนวนโควตาต้องมากกว่า 0', confirmButtonColor: '#0d9488' });
      return;
    }

    if (this.editingUnit) {
      // แก้ไขหน่วยเดิม
      this.editingUnit.name = this.unitForm.name.trim();
      this.editingUnit.shortName = this.unitForm.shortName.trim() || undefined;
      this.editingUnit.category = this.unitForm.category;
      this.editingUnit.totalQuota = Number(this.unitForm.totalQuota);
      this.editingUnit.description = this.unitForm.description.trim() || undefined;

      // อัปเดตชื่อหน่วยในรายชื่อนักเรียนด้วยถ้ามีคนเลือกไว้
      this.students.forEach((s) => {
        if (s.selectedUnitId === this.editingUnit!.id) {
          s.selectedUnitName = this.editingUnit!.name;
        }
      });
    } else {
      // เพิ่มหน่วยใหม่
      const newUnit: UnitQuota = {
        id: 'unit_' + Date.now(),
        name: this.unitForm.name.trim(),
        shortName: this.unitForm.shortName.trim() || undefined,
        category: this.unitForm.category,
        totalQuota: Number(this.unitForm.totalQuota),
        description: this.unitForm.description.trim() || undefined,
      };
      this.units.push(newUnit);
    }

    this.saveUnitsToStorage();
    this.closeUnitModal();

    Swal.fire({
      icon: 'success',
      title: 'บันทึกข้อมูลหน่วยเรียบร้อย',
      timer: 1200,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  }

  deleteUnit(unit: UnitQuota): void {
    const assignedCount = this.getAssignedCount(unit.id);
    if (assignedCount > 0) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถลบหน่วยนี้ได้',
        text: `มีนักเรียนเลือกหน่วยนี้อยู่แล้ว ${assignedCount} คน กรุณายกเลิกการเลือกของนักเรียนก่อนลบ`,
        confirmButtonColor: '#0d9488',
      });
      return;
    }

    Swal.fire({
      icon: 'question',
      title: `ยืนยันการลบหน่วย "${unit.name}" หรือไม่?`,
      showCancelButton: true,
      confirmButtonText: 'ลบหน่วย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#e53e3e',
    }).then((res) => {
      if (res.isConfirmed) {
        this.units = this.units.filter((u) => u.id !== unit.id);
        this.saveUnitsToStorage();
        Swal.fire({
          icon: 'success',
          title: 'ลบหน่วยเรียบร้อย',
          timer: 1200,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      }
    });
  }

  // --- Filtering & Sorting displayed students ---
  get filteredStudents(): StudentUnitAssignment[] {
    let list = [...this.students];

    // กรองคำค้นหา
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.student_code.toLowerCase().includes(q) ||
          (s.selectedUnitName && s.selectedUnitName.toLowerCase().includes(q)) ||
          (s.originalAffiliation && s.originalAffiliation.toLowerCase().includes(q))
      );
    }

    // กรองสถานะ
    if (this.filterStatus === 'assigned') {
      list = list.filter((s) => s.selectedUnitName != null && s.selectedUnitName.trim() !== '');
    } else if (this.filterStatus === 'unassigned') {
      list = list.filter((s) => !s.selectedUnitName || s.selectedUnitName.trim() === '');
    } else if (this.filterStatus === 'in_quota') {
      list = list.filter((s) => this.isStudentInSelectionQuota(s));
    } else if (this.filterStatus === 'pre_assigned') {
      list = list.filter((s) => !this.isStudentInSelectionQuota(s));
    }

    // กรองตามหน่วยเฉพาะ
    if (this.filterUnitId !== 'all') {
      list = list.filter((s) => s.selectedUnitId === this.filterUnitId);
    }

    // จัดเรียง
    list.sort((a, b) => {
      let comparison = 0;
      if (this.sortBy === 'rank') {
        if (this.isQuotaActive) {
          const aInQuota = this.isStudentInSelectionQuota(a);
          const bInQuota = this.isStudentInSelectionQuota(b);
          if (aInQuota && bInQuota) {
            comparison = (a.selectionRank ?? 9999) - (b.selectionRank ?? 9999);
          } else if (aInQuota && !bInQuota) {
            comparison = -1; // ผู้มีสิทธิ์เลือกหน่วย (16-30) ขึ้นก่อน เรียงตามเลือกลำดับที่ 1 ถึง 15
          } else if (!aInQuota && bInQuota) {
            comparison = 1;
          } else {
            const cA = this.parseStudentCode(a.student_code) || 0;
            const cB = this.parseStudentCode(b.student_code) || 0;
            comparison = cA - cB;
          }
        } else {
          comparison = (a.rank ?? 9999) - (b.rank ?? 9999);
        }
      } else if (this.sortBy === 'code') {
        const cA = parseInt(a.student_code, 10);
        const cB = parseInt(b.student_code, 10);
        if (!isNaN(cA) && !isNaN(cB)) comparison = cA - cB;
        else comparison = a.student_code.localeCompare(b.student_code);
      } else if (this.sortBy === 'name') {
        comparison = a.full_name.localeCompare(b.full_name);
      } else if (this.sortBy === 'total_weighted') {
        comparison = a.total_weighted_score - b.total_weighted_score;
      } else if (this.sortBy === 'behavior') {
        comparison = a.behavior_score - b.behavior_score;
      } else if (this.sortBy === 'academic_80') {
        comparison = a.academic_score_80 - b.academic_score_80;
      } else if (this.sortBy === 'behavior_20') {
        comparison = a.behavior_score_20 - b.behavior_score_20;
      } else if (this.sortBy === 'final_score') {
        comparison = a.final_score - b.final_score;
      } else if (this.sortBy === 'unit') {
        const uA = a.selectedUnitName || a.originalAffiliation || 'zzz';
        const uB = b.selectedUnitName || b.originalAffiliation || 'zzz';
        comparison = uA.localeCompare(uB);
      } else if (this.sortBy.startsWith('sub_raw_')) {
        const subId = Number(this.sortBy.replace('sub_raw_', ''));
        const getSubRaw = (st: StudentUnitAssignment) => {
          if (st.subject_raw_scores && st.subject_raw_scores[subId] !== undefined) {
            return Number(st.subject_raw_scores[subId]);
          }
          for (const grp of Object.values(st.group_scores || {})) {
            if (grp.subject_scores && grp.subject_scores[subId]?.raw_score !== undefined) {
              return Number(grp.subject_scores[subId].raw_score);
            }
          }
          return 0;
        };
        comparison = getSubRaw(a) - getSubRaw(b);
      } else if (this.sortBy.startsWith('group_raw_')) {
        const gId = Number(this.sortBy.replace('group_raw_', ''));
        const sA = a.group_scores[gId]?.raw_score || 0;
        const sB = b.group_scores[gId]?.raw_score || 0;
        comparison = sA - sB;
      } else if (this.sortBy.startsWith('group_max_')) {
        const gId = Number(this.sortBy.replace('group_max_', ''));
        const sA = a.group_scores[gId]?.max_weighted_score || a.group_scores[gId]?.max_score || 0;
        const sB = b.group_scores[gId]?.max_weighted_score || b.group_scores[gId]?.max_score || 0;
        comparison = sA - sB;
      } else if (this.sortBy.startsWith('group_w_')) {
        const gId = Number(this.sortBy.replace('group_w_', ''));
        const sA = a.group_scores[gId]?.weighted_score || 0;
        const sB = b.group_scores[gId]?.weighted_score || 0;
        comparison = sA - sB;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }

  setSort(by: string): void {
    if (this.sortBy === by) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = by;
      if (['total_weighted', 'behavior', 'academic_80', 'behavior_20', 'final_score'].includes(by) || by.startsWith('group_') || by.startsWith('sub_')) {
        this.sortDirection = 'desc';
      } else {
        this.sortDirection = 'asc';
      }
    }
  }

  // --- พิมพ์รายงาน (Print) ---
  printPage(): void {
    window.print();
  }

  // --- ส่งออก Excel (Export Excel) ในรูปแบบตารางมาตรฐานทางการศึกษาและการเลือกหน่วย ---
  async exportToExcel(): Promise<void> {
    if (this.students.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูลสำหรับส่งออก', confirmButtonColor: '#0d9488' });
      return;
    }

    const currentBatchName =
      this.batches.find((b) => Number(b.id) === Number(this.selectedBatch))?.name ||
      `รุ่นที่ ${this.selectedBatch}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ระบบจัดการผลการเรียนและเลือกลงหน่วย';
    workbook.created = new Date();

    // Sheet 1: รายชื่อนักเรียนและการเลือกหน่วย พร้อมคะแนนและสูตรคำนวณ
    const worksheet = workbook.addWorksheet('บัญชีเลือกหน่วยลงบรรจุ');

    // Freeze panes: ตรึง 3 คอลัมน์แรก (ลำดับ, เลขที่, ยศ ชื่อ-สกุล) และตรึง 3 แถวบนสุด (หัวตาราง)
    worksheet.views = [
      { state: 'frozen', xSplit: 3, ySplit: 3 },
    ];

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    };

    const formatCreditDisplay = (credit: number): string => {
      if (Math.abs(credit - Math.round(credit)) < 0.001) {
        return String(Math.round(credit));
      }
      return String(credit);
    };

    const formatMaxScoreDisplay = (maxScore: number): string => {
      if (Math.abs(maxScore - Math.round(maxScore)) < 0.001) {
        return String(Math.round(maxScore));
      }
      return Number(maxScore.toFixed(2)).toString();
    };

    const getRawScoreCell = (rawScore: number | undefined | null): { value: number | string; numFmt?: string } => {
      if (rawScore === undefined || rawScore === null) return { value: 0, numFmt: '#,##0' };
      const n = Number(rawScore);
      if (isNaN(n)) return { value: 0, numFmt: '#,##0' };
      if (Math.abs(n - Math.round(n)) < 0.0001) {
        return { value: Math.round(n), numFmt: '#,##0' };
      }
      if (Math.abs(n * 10 - Math.round(n * 10)) < 0.001) {
        return { value: Number(n.toFixed(1)), numFmt: '#,##0.0' };
      }
      return { value: Number(n.toFixed(2)), numFmt: '#,##0.00' };
    };

    const getWeightedScoreCell = (weightedScore: number | undefined | null, credit: number): { value: number | string; numFmt?: string } => {
      if (weightedScore === undefined || weightedScore === null) return { value: 0, numFmt: '#,##0' };
      const n = Number(weightedScore);
      if (isNaN(n)) return { value: 0, numFmt: '#,##0' };
      const isCreditInteger = Math.abs(credit - Math.round(credit)) < 0.001;
      const isScoreInteger = Math.abs(n - Math.round(n)) < 0.0001;
      if (isCreditInteger && isScoreInteger) {
        return { value: Math.round(n), numFmt: '#,##0' };
      }
      return { value: Number(n.toFixed(2)), numFmt: '#,##0.00' };
    };

    interface ExportColumn {
      colIndex: number;
      key: string;
      width: number;
      h1: string;
      h2?: string;
      h3?: string;
      mergeH1ToCol?: number;
      mergeRows1To3?: boolean;
      align: 'left' | 'center' | 'right';
      type: 'rank' | 'code' | 'name' | 'orig_aff' | 'raw_score' | 'weighted_score' | 'total_w' | 'behavior' | 'acad_80' | 'beh_20' | 'final_score' | 'unit' | 'time' | 'notes';
      groupId?: number;
      subId?: number;
      credit?: number;
    }

    const cols: ExportColumn[] = [];
    let cIdx = 1;

    // 1. ลำดับ
    cols.push({
      colIndex: cIdx++,
      key: 'rank',
      width: 8,
      h1: 'ลำดับ',
      mergeRows1To3: true,
      align: 'center',
      type: 'rank',
    });

    // 2. เลขที่
    cols.push({
      colIndex: cIdx++,
      key: 'code',
      width: 8,
      h1: 'เลขที่',
      mergeRows1To3: true,
      align: 'center',
      type: 'code',
    });

    // 3. ยศ ชื่อ-สกุล
    cols.push({
      colIndex: cIdx++,
      key: 'name',
      width: 28,
      h1: 'ยศ ชื่อ-สกุล',
      mergeRows1To3: true,
      align: 'left',
      type: 'name',
    });

    // 4. สังกัดเดิม
    cols.push({
      colIndex: cIdx++,
      key: 'orig_aff',
      width: 18,
      h1: 'สังกัดเดิม',
      mergeRows1To3: true,
      align: 'left',
      type: 'orig_aff',
    });

    // วนลูปรายวิชา
    this.subjectGroups.forEach((grp) => {
      if (grp.isMerged && grp.subjects && grp.subjects.length > 1) {
        // กลุ่มเมิร์จ: แยกคะแนนดิบแต่ละวิชาในแถวที่ 1-3
        grp.subjects.forEach((sub) => {
          cols.push({
            colIndex: cIdx++,
            key: `sub_${sub.id}_raw`,
            width: 12,
            h1: sub.name,
            h2: 'คะแนนดิบ',
            h3: formatMaxScoreDisplay(sub.max_score),
            align: 'center',
            type: 'raw_score',
            groupId: grp.groupId,
            subId: sub.id,
          });
        });
        // คอลัมน์รวมกลุ่มเมิร์จ: วิชารวมกัน + หน่วยกิต + ค่าน้ำหนัก
        cols.push({
          colIndex: cIdx++,
          key: `grp_${grp.groupId}_w`,
          width: 14,
          h1: `${grp.subjects.length} วิชารวมกัน`,
          h2: `หน่วยกิต ${formatCreditDisplay(grp.credit)}`,
          h3: `ค่าน้ำหนัก ${formatMaxScoreDisplay(grp.group_max_weighted || ((grp.group_max_score || 0) * grp.credit))}`,
          align: 'center',
          type: 'weighted_score',
          groupId: grp.groupId,
          credit: grp.credit,
        });
      } else {
        // วิชาเดี่ยวทั่วไป: 2 คอลัมน์ (คะแนนดิบ | หน่วยกิต)
        const rawColIdx = cIdx++;
        const wColIdx = cIdx++;
        const subjectLabel = grp.subjectNames || grp.displayName || grp.groupName;

        cols.push({
          colIndex: rawColIdx,
          key: `grp_${grp.groupId}_raw`,
          width: 11,
          h1: subjectLabel,
          mergeH1ToCol: wColIdx, // แถวที่ 1 รวม 2 คอลัมน์ของวิชานี้
          h2: 'คะแนนดิบ',
          h3: formatMaxScoreDisplay(grp.group_max_score || 100),
          align: 'center',
          type: 'raw_score',
          groupId: grp.groupId,
        });

        cols.push({
          colIndex: wColIdx,
          key: `grp_${grp.groupId}_w`,
          width: 13,
          h1: subjectLabel,
          h2: `หน่วยกิต ${formatCreditDisplay(grp.credit)}`,
          h3: `ค่าน้ำหนัก ${formatMaxScoreDisplay(grp.group_max_weighted || ((grp.group_max_score || 100) * grp.credit))}`,
          align: 'center',
          type: 'weighted_score',
          groupId: grp.groupId,
          credit: grp.credit,
        });
      }
    });

    // คอลัมน์สรุปผลคะแนน
    cols.push({
      colIndex: cIdx++,
      key: 'total_w',
      width: 16,
      h1: 'คะแนนรวมทั้งหมด',
      h2: 'ทุกวิชา',
      h3: `เต็ม ${this.totalMaxWeightedFormatted}`,
      align: 'center',
      type: 'total_w',
    });

    cols.push({
      colIndex: cIdx++,
      key: 'behavior',
      width: 14,
      h1: 'คะแนนประพฤติ',
      h2: 'ความประพฤติ',
      h3: `เต็ม ${(this.maxBehaviorScore || 200).toFixed(2)}`,
      align: 'center',
      type: 'behavior',
    });

    cols.push({
      colIndex: cIdx++,
      key: 'acad_80',
      width: 17,
      h1: '80% ของคะแนนรวม',
      h2: 'วิชาการ (80 ส่วน)',
      h3: `เต็ม ${this.maxAcademic80Formatted}`,
      align: 'center',
      type: 'acad_80',
    });

    cols.push({
      colIndex: cIdx++,
      key: 'beh_20',
      width: 17,
      h1: '20% ของคะแนนประพฤติ',
      h2: 'ประพฤติ (20 ส่วน)',
      h3: `เต็ม ${this.maxBehavior20Formatted}`,
      align: 'center',
      type: 'beh_20',
    });

    cols.push({
      colIndex: cIdx++,
      key: 'final_score',
      width: 22,
      h1: 'คะแนนรวมสุทธิ',
      h2: '(80% + 20%)',
      h3: `เต็ม ${this.maxFinalScoreFormatted}`,
      align: 'center',
      type: 'final_score',
    });

    // คอลัมน์การเลือกลงหน่วย
    cols.push({
      colIndex: cIdx++,
      key: 'unit',
      width: 32,
      h1: 'หน่วยที่เลือกบรรจุ',
      mergeRows1To3: true,
      align: 'left',
      type: 'unit',
    });

    cols.push({
      colIndex: cIdx++,
      key: 'time',
      width: 18,
      h1: 'วัน-เวลาที่เลือก',
      mergeRows1To3: true,
      align: 'center',
      type: 'time',
    });

    cols.push({
      colIndex: cIdx++,
      key: 'notes',
      width: 16,
      h1: 'หมายเหตุ',
      mergeRows1To3: true,
      align: 'left',
      type: 'notes',
    });

    // กำหนดความกว้างคอลัมน์
    cols.forEach((col) => {
      worksheet.getColumn(col.colIndex).width = col.width;
    });

    // สร้าง Header 3 แถว
    const row1 = worksheet.getRow(1);
    const row2 = worksheet.getRow(2);
    const row3 = worksheet.getRow(3);

    row1.height = 68;
    row2.height = 25;
    row3.height = 25;

    cols.forEach((col) => {
      const c1 = row1.getCell(col.colIndex);
      const c2 = row2.getCell(col.colIndex);
      const c3 = row3.getCell(col.colIndex);

      c1.value = col.h1;
      c2.value = col.h2 || '';
      c3.value = col.h3 || '';

      [c1, c2, c3].forEach((cell) => {
        cell.font = { name: 'TH Sarabun New', size: 11, bold: true, color: { argb: '000000' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
      });
    });

    // ผสานเซลล์หัวตาราง
    cols.forEach((col) => {
      if (col.mergeRows1To3) {
        worksheet.mergeCells(1, col.colIndex, 3, col.colIndex);
      } else if (col.mergeH1ToCol) {
        worksheet.mergeCells(1, col.colIndex, 1, col.mergeH1ToCol);
      }
    });

    // กรอกข้อมูลนักเรียนเริ่มที่แถว 4
    const exportList = this.isQuotaActive ? this.printCoordinationStudents : this.students;
    let rowNum = 4;

    exportList.forEach((s) => {
      const row = worksheet.getRow(rowNum++);
      row.height = 22;
      const isQuota = this.isStudentInSelectionQuota(s);

      cols.forEach((col) => {
        const cell = row.getCell(col.colIndex);
        cell.font = { name: 'TH Sarabun New', size: 11, color: { argb: '000000' } };
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: col.align,
        };

        switch (col.type) {
          case 'rank': {
            const rankVal = this.isQuotaActive
              ? (isQuota ? (s.selectionRank ? s.selectionRank : '-') : 'สังกัดเดิม')
              : (s.rank || '-');
            cell.value = rankVal;
            break;
          }
          case 'code': {
            cell.value = s.student_code;
            break;
          }
          case 'name': {
            cell.value = s.full_name;
            break;
          }
          case 'orig_aff': {
            cell.value = (s.originalAffiliation && s.originalAffiliation !== '-') ? s.originalAffiliation : '-';
            break;
          }
          case 'raw_score': {
            let rawVal = 0;
            if (col.subId !== undefined && col.groupId !== undefined) {
              rawVal = s.group_scores[col.groupId]?.subject_scores?.[col.subId]?.raw_score ?? s.subject_raw_scores?.[col.subId] ?? 0;
            } else if (col.groupId !== undefined) {
              rawVal = s.group_scores[col.groupId]?.raw_score ?? 0;
            }
            const cellInfo = getRawScoreCell(rawVal);
            cell.value = cellInfo.value;
            if (cellInfo.numFmt) cell.numFmt = cellInfo.numFmt;
            break;
          }
          case 'weighted_score': {
            let wVal = 0;
            if (col.groupId !== undefined) {
              wVal = s.group_scores[col.groupId]?.weighted_score ?? 0;
            }
            const cellInfo = getWeightedScoreCell(wVal, col.credit ?? 1);
            cell.value = cellInfo.value;
            if (cellInfo.numFmt) cell.numFmt = cellInfo.numFmt;
            break;
          }
          case 'total_w': {
            const cellInfo = getWeightedScoreCell(s.total_weighted_score, 0.5);
            cell.value = cellInfo.value;
            if (cellInfo.numFmt) cell.numFmt = cellInfo.numFmt;
            cell.font = { name: 'TH Sarabun New', size: 11, bold: true, color: { argb: '000000' } };
            break;
          }
          case 'behavior': {
            const cellInfo = getRawScoreCell(s.behavior_score);
            cell.value = cellInfo.value;
            if (cellInfo.numFmt) cell.numFmt = cellInfo.numFmt;
            break;
          }
          case 'acad_80': {
            cell.value = Number(s.academic_score_80.toFixed(4));
            cell.numFmt = '#,##0.0000';
            break;
          }
          case 'beh_20': {
            cell.value = Number(s.behavior_score_20.toFixed(4));
            cell.numFmt = '#,##0.0000';
            break;
          }
          case 'final_score': {
            cell.value = Number(s.final_score.toFixed(4));
            cell.numFmt = '#,##0.0000';
            cell.font = { name: 'TH Sarabun New', size: 11, bold: true, color: { argb: '0F766E' } };
            break;
          }
          case 'unit': {
            const unitVal = isQuota
              ? (s.selectedUnitName || 'ยังไม่ได้เลือกหน่วย')
              : ((s.originalAffiliation && s.originalAffiliation !== '-') ? s.originalAffiliation : 'สังกัดเดิม');
            cell.value = unitVal;
            if (s.selectedUnitName) {
              cell.font = { name: 'TH Sarabun New', size: 11, bold: true, color: { argb: '1E3A8A' } };
            }
            break;
          }
          case 'time': {
            cell.value = s.assignedAt || '-';
            break;
          }
          case 'notes': {
            cell.value = s.notes || '-';
            break;
          }
        }
      });
    });

    // Sheet 2: สรุปยอดโควตาแต่ละหน่วย
    const summarySheet = workbook.addWorksheet('สรุปยอดโควตาหน่วย');
    summarySheet.columns = [
      { header: 'ลำดับ', key: 'no', width: 8 },
      { header: 'ชื่อหน่วยที่เปิดรับ', key: 'unit_name', width: 40 },
      { header: 'เหล่า/สายงาน', key: 'category', width: 22 },
      { header: 'โควตารับทั้งหมด (อัตรา)', key: 'quota', width: 24 },
      { header: 'จำนวนที่เลือกแล้ว (คน)', key: 'filled', width: 24 },
      { header: 'โควตาคงเหลือ (อัตรา)', key: 'remaining', width: 24 },
      { header: 'สถานะ', key: 'status', width: 16 },
    ];

    const sumHeaderRow = summarySheet.getRow(1);
    sumHeaderRow.height = 28;
    sumHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0F766E' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'TH Sarabun New' };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    this.units.forEach((u, i) => {
      const filled = this.getAssignedCount(u.id);
      const remaining = this.getRemainingQuota(u);
      const row = summarySheet.addRow({
        no: i + 1,
        unit_name: u.name,
        category: u.category || '-',
        quota: u.totalQuota,
        filled: filled,
        remaining: remaining,
        status: remaining <= 0 ? 'เต็มแล้ว' : `ว่าง ${remaining}`,
      });
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { size: 11, name: 'TH Sarabun New' };
        cell.border = thinBorder;
        if ([1, 4, 5, 6, 7].includes(colNum)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `บัญชีเลือกหน่วยลงบรรจุ_${currentBatchName}.xlsx`);
  }
}
