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

export interface SubjectScoreDetail {
  groupId: number;
  groupName: string;
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
  originalAffiliation: string;
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

  // โควตาผู้มีสิทธิ์เลือกหน่วยตามลำดับ (เช่น 15 คนแรกสำหรับช่างอิเล็กทรอนิกส์ ส่วนที่เหลือดึงสังกัดเดิม)
  selectionQuotaCount: number | null = null;

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

  isStudentInSelectionQuota(student: StudentUnitAssignment): boolean {
    if (!this.selectionQuotaCount || this.selectionQuotaCount <= 0) return true;
    return (student.rank || 0) <= this.selectionQuotaCount;
  }

  get selectionQuotaStudents(): StudentUnitAssignment[] {
    if (!this.selectionQuotaCount || this.selectionQuotaCount <= 0) return this.students;
    return this.students.filter((s) => (s.rank || 0) <= this.selectionQuotaCount!);
  }

  get preAssignedStudents(): StudentUnitAssignment[] {
    if (!this.selectionQuotaCount || this.selectionQuotaCount <= 0) return [];
    return this.students.filter((s) => (s.rank || 0) > this.selectionQuotaCount!);
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
    if (this.selectionQuotaCount && this.selectionQuotaCount > 0) {
      return this.selectionQuotaUnassignedCount;
    }
    return this.students.filter((s) => !s.selectedUnitName || s.selectedUnitName.trim() === '').length;
  }

  printCoordinationSheet(): void {
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

  computeEstimatedTableWidth(): number {
    const subjectCount = this.subjectGroups?.length || 0;
    // 4 คอลัมน์แรก (ลำดับ, เลขที่, ยศ-ชื่อ, สังกัดเดิม): ~520px
    // วิชา (2 คอลัมน์ต่อวิชา คะแนนดิบ 80px + คะแนนดิบ*นก. 130px + ขอบ/padding ~225px): ~225px ต่อวิชา
    // ส่วนสรุปคะแนนรวมท้ายวิชา (8 คอลัมน์): ~950px
    // ส่วนเลือกหน่วยบรรจุ (4 คอลัมน์): ~650px
    // ระยะเผื่อขอบ: ~250px
    const baseColsWidth = 520;
    const subjectsWidth = subjectCount * 225;
    const summaryColsWidth = 950;
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
          this.selectionQuotaCount = cfg.selectionQuotaCount !== undefined ? cfg.selectionQuotaCount : (this.isTechnicianCourse ? 15 : null);
        } else {
          this.isBatchEnabledForUnitSelection = true;
          this.selectionQuotaCount = this.isTechnicianCourse ? 15 : null;
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
          selectionQuotaCount: this.selectionQuotaCount,
        })
      );
    } catch (_) {}
  }

  toggleBatchEnabled(): void {
    this.isBatchEnabledForUnitSelection = !this.isBatchEnabledForUnitSelection;
    this.saveConfig();
  }

  setSelectionQuota(count: number | null): void {
    this.selectionQuotaCount = count;
    this.saveConfig();

    // เมื่อกำหนดโควตา ดึงสังกัดเดิมให้อัตโนมัติสำหรับคนที่มีหน่วยเดิม (ลำดับที่ count + 1 เป็นต้นไป)
    if (count && count > 0) {
      let filled = 0;
      this.students.forEach((s) => {
        if ((s.rank || 0) > count) {
          if (!s.selectedUnitName && s.originalAffiliation && s.originalAffiliation !== '-') {
            s.selectedUnitName = s.originalAffiliation;
            s.selectedUnitId = 'orig_' + s.student_id;
            s.assignedAt = 'บรรจุสังกัดเดิม';
            filled++;
          }
        }
      });
      if (filled > 0) {
        this.hasUnsavedChanges = true;
      }
    }
    this.cdr.detectChanges();
  }

  onSelectionQuotaInputChange(val: any): void {
    const num = Number(val);
    if (!val || isNaN(num) || num <= 0) {
      this.setSelectionQuota(null);
    } else {
      this.setSelectionQuota(Math.min(this.students.length || 999, Math.max(1, num)));
    }
  }

  applyPreAssignedAffiliations(): void {
    if (!this.selectionQuotaCount || this.selectionQuotaCount <= 0) {
      if (this.isTechnicianCourse && this.students.length >= 20) {
        this.selectionQuotaCount = 15;
      }
    }

    let count = 0;
    this.students.forEach((s) => {
      if (!this.isStudentInSelectionQuota(s)) {
        if (!s.selectedUnitName || s.selectedUnitName.trim() === '') {
          if (s.originalAffiliation && s.originalAffiliation !== '-') {
            s.selectedUnitName = s.originalAffiliation;
            s.selectedUnitId = 'orig_' + s.student_id;
            s.assignedAt = 'บรรจุสังกัดเดิม';
            count++;
          }
        }
      }
    });

    this.hasUnsavedChanges = true;
    this.saveConfig();
    this.cdr.detectChanges();

    if (count > 0) {
      Swal.fire({
        icon: 'success',
        title: 'ดึงสังกัดเดิมสำเร็จ',
        text: `ดึงสังกัดเดิมลงเป็นหน่วยบรรจุให้ ${count} นายเรียบร้อยแล้ว`,
        timer: 1600,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'ตรวจสอบเรียบร้อย',
        text: 'นักเรียนกลุ่มมีหน่วยเดิม มีชื่อหน่วยครบถ้วนแล้ว',
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

    if (this.isTechnicianCourse && (!this.selectionQuotaCount || this.selectionQuotaCount <= 0)) {
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

      const isQuotaLimit = this.selectionQuotaCount && this.selectionQuotaCount > 0;
      const isInQuota = !isQuotaLimit || (rank <= this.selectionQuotaCount!);

      if (savedItem && savedItem.unitName && savedItem.unitName.trim() !== '') {
        selectedUnitId = savedItem.unitId;
        selectedUnitName = savedItem.unitName;
        assignedAt = savedItem.assignedAt;
        notes = savedItem.notes || '';
      } else {
        if (!isInQuota && origAff) {
          // อยู่นอกโควตาเลือกหน่วย (เช่น ลำดับที่ 16 เป็นต้นไปในช่างอิเล็กทรอนิกส์) -> ดึงสังกัดเดิมลงเป็นหน่วยบรรจุให้อัตโนมัติ
          selectedUnitId = 'orig_' + sId;
          selectedUnitName = origAff;
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
        comparison = (a.rank ?? 9999) - (b.rank ?? 9999);
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
        const uA = a.selectedUnitName || 'zzz';
        const uB = b.selectedUnitName || 'zzz';
        comparison = uA.localeCompare(uB);
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
      if (['total_weighted', 'behavior', 'academic_80', 'behavior_20', 'final_score'].includes(by) || by.startsWith('group_')) {
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

  // --- ส่งออก Excel (Export Excel) ---
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

    // Sheet 1: รายชื่อนักเรียนและการเลือกหน่วย พร้อมคะแนนและสูตรคำนวณทศนิยม 4 ตำแหน่ง
    const worksheet = workbook.addWorksheet('บัญชีเลือกหน่วยลงบรรจุ');

    const dynamicColumns: any[] = [
      { header: 'ลำดับที่', key: 'rank', width: 10 },
      { header: 'เลขที่', key: 'code', width: 12 },
      { header: 'ยศ-ชื่อ-นามสกุล', key: 'name', width: 32 },
      { header: 'สังกัดเดิม', key: 'orig_aff', width: 22 },
    ];

    // เพิ่มคอลัมน์วิชาแต่ละกลุ่ม (1. คะแนนดิบ, 2. คะแนนดิบ * ค่าน้ำหนัก) พร้อมชื่อวิชา
    this.subjectGroups.forEach((grp) => {
      const subjectLabel = grp.subjectNames ? `${grp.groupName} ${grp.subjectNames}` : grp.groupName;
      dynamicColumns.push({
        header: `${subjectLabel} (คะแนนดิบ)`,
        key: `grp_${grp.groupId}_raw`,
        width: 22,
      });
      dynamicColumns.push({
        header: `${subjectLabel} (ดิบ*${grp.credit} นก.)`,
        key: `grp_${grp.groupId}_w`,
        width: 24,
      });
    });

    // คอลัมน์สรุปผลคะแนน
    dynamicColumns.push(
      { header: 'คะแนนรวมทั้งหมด', key: 'total_w', width: 18 },
      { header: 'คะแนนประพฤติ', key: 'behavior', width: 16 },
      { header: '80% ของคะแนนรวม', key: 'acad_80', width: 20 },
      { header: '20% ของคะแนนประพฤติ', key: 'beh_20', width: 20 },
      { header: 'คะแนนรวมสุทธิ (80% + 20%)', key: 'final_score', width: 24 },
      { header: 'หน่วยที่เลือกบรรจุ', key: 'unit', width: 36 },
      { header: 'วัน-เวลาที่เลือก', key: 'time', width: 22 },
      { header: 'หมายเหตุ', key: 'notes', width: 20 }
    );

    worksheet.columns = dynamicColumns;

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell, colNum) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0D9488' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'Sarabun' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    this.students.forEach((s) => {
      const rowData: Record<string, any> = {
        rank: s.rank || '-',
        code: s.student_code,
        name: s.full_name,
        orig_aff: s.originalAffiliation,
        total_w: s.total_weighted_score_formatted,
        behavior: s.behavior_score_formatted,
        acad_80: s.academic_score_80_formatted,
        beh_20: s.behavior_score_20_formatted,
        final_score: s.final_score_formatted,
        unit: s.selectedUnitName || 'ยังไม่ได้เลือกหน่วย',
        time: s.assignedAt || '-',
        notes: s.notes || '-',
      };

      this.subjectGroups.forEach((grp) => {
        const scoreInfo = s.group_scores[grp.groupId];
        rowData[`grp_${grp.groupId}_raw`] = scoreInfo?.raw_score_formatted || '0.0000';
        rowData[`grp_${grp.groupId}_w`] = scoreInfo?.weighted_score_formatted || '0.0000';
      });

      const row = worksheet.addRow(rowData);
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { size: 11, name: 'Sarabun' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };

        const colKey = dynamicColumns[colNum - 1]?.key;
        if (colKey === 'name' || colKey === 'orig_aff' || colKey === 'unit' || colKey === 'notes') {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        if (colKey === 'final_score') {
          cell.font = { bold: true, color: { argb: '0F766E' }, size: 11, name: 'Sarabun' };
        }
        if (colKey === 'unit' && s.selectedUnitName) {
          cell.font = { bold: true, color: { argb: '1E3A8A' }, size: 11, name: 'Sarabun' };
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
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12, name: 'Sarabun' };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
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
        cell.font = { size: 11, name: 'Sarabun' };
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
