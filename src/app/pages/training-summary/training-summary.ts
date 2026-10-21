import { CommonModule } from '@angular/common';
import { Component, OnInit, AfterViewInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { CourseService } from '../../services/course.service';

Chart.register(...registerables);

export interface BatchItem {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface SubjectItem {
  id: number;
  name: string;
  is_su: boolean;
  batchScores: Record<number, number | null>;
  avgScore: number;
  diff: number | null;
}

export interface PairwiseComparisonItem {
  key: string;
  prevBatchId: number;
  prevBatchName: string;
  currBatchId: number;
  currBatchName: string;
  label: string;
}

export interface CourseOption {
  course_id: number;
  course_name: string;
  curriculum_year?: number;
  years?: number[];
  is_active: boolean;
  batches: any[];
}

@Component({
  selector: 'app-training-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, RouterModule],
  templateUrl: './training-summary.html',
  styleUrl: './training-summary.scss',
})
export class TrainingSummary implements OnInit, AfterViewInit {
  private courseService = inject(CourseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading: boolean = false;
  isActive: boolean = true;
  inactiveMessage: string = '';

  selectedCourseId: number | null = null;
  selectedCourseName: string = '';
  courseTitle: string = '';
  curriculumYear: number | null = null;

  availableCourses: CourseOption[] = [];
  batches: BatchItem[] = [];
  pairwiseComparisons: PairwiseComparisonItem[] = [];
  subjects: SubjectItem[] = [];

  totalAvg: number = 0;
  topImproved: { name: string; diff: number } | null = null;
  topDeclined: { name: string; diff: number } | null = null;
  actionPlans: string[] = [];

  // บทสรุปที่บันทึกไว้ในฐานข้อมูล (Custom / Admin Approved Summary)
  hasSavedSummary: boolean = false;
  savedExecutiveSummary: string = '';
  savedActionPlans: string[] = [];

  // ตัวเลือกมุมมอง: 'all', 'compare:prevId:currId', 'single:batchId'
  selectedCohort: string = 'all';
  chartType: 'bar' | 'line' = 'bar';
  mainChart: any;

  // ตัวกรองแสดงผลในกราฟ (ทั้งหมด / Top 3 / Bottom 3)
  chartFilter: string = 'all';

  // สถานะและตัวแปรสำหรับ Admin & บทสรุปผลการฝึกอบรม
  isAdmin: boolean = false;
  isPreviewMode: boolean = false;
  showAdminModal: boolean = false;
  isAiGenerating: boolean = false;
  isSavingSummary: boolean = false;
  saveSuccessMessage: string = '';
  selectedAiStyle: 'comprehensive' | 'executive' | 'action' = 'comprehensive';
  adminExecutiveSummary: string = '';
  adminActionPlanText: string = '';

  palette = [
    { bg: '#94a3b8', border: '#64748b', class: 'slate' },
    { bg: '#3b82f6', border: '#2563eb', class: 'blue' },
    { bg: '#8b5cf6', border: '#7c3aed', class: 'purple' },
    { bg: '#10b981', border: '#059669', class: 'green' },
    { bg: '#f59e0b', border: '#d97706', class: 'amber' },
    { bg: '#ec4899', border: '#db2777', class: 'pink' },
  ];

  ngOnInit(): void {
    this.checkAdminStatus();
    this.route.queryParams.subscribe((params: any) => {
      const courseName = params['course'] || params['courseName'];
      const courseId = params['courseId'] ? Number(params['courseId']) : undefined;
      this.checkAdminStatus();
      this.loadTrainingSummary(courseId, courseName);
    });
  }

  onSelectStyle(style: 'comprehensive' | 'executive' | 'action'): void {
    this.selectedAiStyle = style;
    this.generateWithAi('generate');
  }

  ngAfterViewInit(): void {}

  checkAdminStatus(): void {
    const isUnderAdminRoute = this.router.url.includes('/admin');
    const hasAdminQuery = this.route.snapshot.queryParams['admin'] === 'true' || this.route.snapshot.queryParams['mode'] === 'admin';
    this.isAdmin = isUnderAdminRoute || hasAdminQuery;
  }

  loadTrainingSummary(courseId?: number, courseName?: string): void {
    this.isLoading = true;
    // ล้างข้อมูลเก่าออกทันที เพื่อไม่ให้ข้อมูลหลักสูตรเดิมค้าง
    this.batches = [];
    this.pairwiseComparisons = [];
    this.subjects = [];
    this.totalAvg = 0;
    this.topImproved = null;
    this.topDeclined = null;
    this.actionPlans = [];
    this.hasSavedSummary = false;
    this.savedExecutiveSummary = '';
    this.savedActionPlans = [];
    this.adminExecutiveSummary = '';
    this.adminActionPlanText = '';
    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }
    this.cdr.detectChanges();

    this.courseService.getTrainingSummary(courseId, courseName).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res && res.success) {
          this.isActive = res.isActive !== false;
          this.availableCourses = res.availableCourses || [];

          if (res.course) {
            this.selectedCourseId = res.course.id;
            this.courseTitle = res.course.name;
            this.selectedCourseName = res.course.name;
            this.curriculumYear = res.course.year || res.course.years?.[0] || null;
          }

          if (!this.isActive) {
            this.inactiveMessage = res.message || 'หลักสูตรนี้ปิดใช้งาน หรือยังไม่มีรุ่นที่เปิดใช้งานในขณะนี้';
            this.batches = [];
            this.pairwiseComparisons = [];
            this.subjects = [];
            if (this.mainChart) {
              this.mainChart.destroy();
              this.mainChart = null;
            }
            this.cdr.detectChanges();
            return;
          }

          this.batches = res.batches || [];
          this.pairwiseComparisons = res.pairwiseComparisons || [];
          this.subjects = res.subjects || [];
          this.totalAvg = res.totalAvg || 0;
          this.topImproved = res.topImproved || null;
          this.topDeclined = res.topDeclined || null;
          this.actionPlans = res.actionPlans || [];

          // ตั้งค่าเริ่มต้นมุมมอง
          if (this.pairwiseComparisons.length > 0) {
            this.selectedCohort = this.pairwiseComparisons[this.pairwiseComparisons.length - 1].key;
          } else if (this.batches.length > 1) {
            this.selectedCohort = 'all';
          } else if (this.batches.length === 1) {
            this.selectedCohort = 'single:' + this.batches[0].id;
          } else {
            this.selectedCohort = 'all';
          }

          this.chartFilter = 'all';
          this.loadSavedSummary();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.renderChart();
          }, 150);
        } else {
          this.isActive = false;
          this.inactiveMessage = res?.message || 'ไม่สามารถโหลดข้อมูลหลักสูตรได้';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.isActive = false;
        this.inactiveMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์';
        console.error('Error fetching training summary:', err);
        this.cdr.detectChanges();
      },
    });
  }

  loadSavedSummary(): void {
    if (!this.courseTitle || !this.selectedCohort) return;
    this.courseService.getSavedTrainingSummary(this.courseTitle, this.selectedCohort).subscribe({
      next: (res: any) => {
        if (res && res.success && res.hasData && res.data) {
          this.hasSavedSummary = true;
          this.savedExecutiveSummary = res.data.executive_summary || '';
          this.savedActionPlans = res.data.action_plan || [];
          this.adminExecutiveSummary = this.savedExecutiveSummary;
          this.adminActionPlanText = this.savedActionPlans.join('\n');
        } else {
          this.hasSavedSummary = false;
          this.savedExecutiveSummary = '';
          this.savedActionPlans = [];
          this.adminExecutiveSummary = this.buildDefaultExecutiveSummary();
          this.adminActionPlanText = this.actionPlans.join('\n');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading saved summary:', err);
      },
    });
  }

  get displayedBatches(): BatchItem[] {
    if (!this.selectedCohort || this.selectedCohort === 'all') {
      return this.batches;
    }
    if (this.selectedCohort.startsWith('compare:')) {
      const parts = this.selectedCohort.split(':');
      const prevId = Number(parts[1]);
      const currId = Number(parts[2]);
      const b1 = this.batches.find((b) => b.id === prevId);
      const b2 = this.batches.find((b) => b.id === currId);
      return [b1, b2].filter(Boolean) as BatchItem[];
    }
    if (this.selectedCohort.startsWith('single:')) {
      const singleId = Number(this.selectedCohort.split(':')[1]);
      const b = this.batches.find((b) => b.id === singleId);
      return b ? [b] : this.batches;
    }
    return this.batches;
  }

  get isPairwiseCompare(): boolean {
    return this.selectedCohort.startsWith('compare:');
  }

  get isAllCompare(): boolean {
    return this.selectedCohort === 'all' && this.batches.length > 1;
  }

  get isSingleView(): boolean {
    return this.selectedCohort.startsWith('single:') || this.batches.length === 1;
  }

  get currentPair(): PairwiseComparisonItem | undefined {
    return this.pairwiseComparisons.find((p) => p.key === this.selectedCohort);
  }

  get currentCohortDisplayLabel(): string {
    if (this.isPairwiseCompare && this.currentPair) {
      return `เปรียบเทียบ ${this.currentPair.prevBatchName} กับ ${this.currentPair.currBatchName}`;
    }
    if (this.isSingleView && this.displayedBatches.length === 1) {
      return `เฉพาะ ${this.displayedBatches[0].name}`;
    }
    return 'ภาพรวมทุกรุ่น';
  }

  /* ------------------- KPI Card Calculations ------------------- */
  get prevBatchAvg(): number {
    if (!this.currentPair) return 0;
    const scores = this.subjects
      .map((s) => s.batchScores[this.currentPair!.prevBatchId])
      .filter((v): v is number => v !== null && v !== undefined && v > 0);
    return scores.length > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0;
  }

  get currBatchAvg(): number {
    if (!this.currentPair) return 0;
    const scores = this.subjects
      .map((s) => s.batchScores[this.currentPair!.currBatchId])
      .filter((v): v is number => v !== null && v !== undefined && v > 0);
    return scores.length > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0;
  }

  get pairAvgDiff(): number {
    return Number((this.currBatchAvg - this.prevBatchAvg).toFixed(2));
  }

  get increasedSubjectCount(): number {
    if (!this.isPairwiseCompare) return 0;
    return this.subjects.filter((s) => {
      const d = this.getSubjectDiff(s);
      return d !== null && d > 0;
    }).length;
  }

  get decreasedSubjectCount(): number {
    if (!this.isPairwiseCompare) return 0;
    return this.subjects.filter((s) => {
      const d = this.getSubjectDiff(s);
      return d !== null && d < 0;
    }).length;
  }

  get singleBatchAvg(): number {
    if (this.displayedBatches.length === 0) return 0;
    const bId = this.displayedBatches[0].id;
    const scores = this.subjects
      .map((s) => s.batchScores[bId])
      .filter((v): v is number => v !== null && v !== undefined && v > 0);
    return scores.length > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0;
  }

  get singleTopSubject(): { name: string; score: number } | null {
    if (this.displayedBatches.length === 0) return null;
    const bId = this.displayedBatches[0].id;
    const valid = this.subjects
      .map((s) => ({ name: s.name, score: s.batchScores[bId] || 0 }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return valid[0] || null;
  }

  get singleBottomSubject(): { name: string; score: number } | null {
    if (this.displayedBatches.length === 0) return null;
    const bId = this.displayedBatches[0].id;
    const valid = this.subjects
      .map((s) => ({ name: s.name, score: s.batchScores[bId] || 0 }))
      .filter((s) => s.score > 0)
      .sort((a, b) => a.score - b.score);
    return valid[0] || null;
  }

  getSubjectDiff(subject: SubjectItem): number | null {
    if (this.isPairwiseCompare) {
      const pair = this.currentPair;
      if (pair) {
        const prevScore = subject.batchScores[pair.prevBatchId];
        const currScore = subject.batchScores[pair.currBatchId];
        if (prevScore !== null && prevScore !== undefined && currScore !== null && currScore !== undefined) {
          return Number((currScore - prevScore).toFixed(1));
        }
      }
      return null;
    }
    if (this.isAllCompare) {
      return subject.diff;
    }
    return null;
  }

  get currentTopImproved(): { name: string; diff: number } | null {
    if (this.isPairwiseCompare) {
      const diffs = this.subjects
        .map((s) => ({ name: s.name, diff: this.getSubjectDiff(s) }))
        .filter((s): s is { name: string; diff: number } => s.diff !== null && s.diff > 0);
      return diffs.sort((a, b) => b.diff - a.diff)[0] || null;
    }
    return this.topImproved;
  }

  get currentTopDeclined(): { name: string; diff: number } | null {
    if (this.isPairwiseCompare) {
      const diffs = this.subjects
        .map((s) => ({ name: s.name, diff: this.getSubjectDiff(s) }))
        .filter((s): s is { name: string; diff: number } => s.diff !== null && s.diff < 0);
      return diffs.sort((a, b) => a.diff - b.diff)[0] || null;
    }
    return this.topDeclined;
  }

  getRatingLevel(score: number | null | undefined): string {
    if (score === null || score === undefined || score === 0) return '-';
    if (score >= 90.2) return 'มากที่สุด';
    if (score >= 70.2) return 'มาก';
    if (score >= 50.2) return 'ปานกลาง';
    if (score >= 30.2) return 'พอใช้';
    return 'ปรับปรุง';
  }

  onAdminCourseChange(): void {
    if (this.selectedCourseName) {
      this.loadTrainingSummary(undefined, this.selectedCourseName);
    }
  }

  onCohortChange(): void {
    this.chartFilter = 'all';
    this.loadSavedSummary();
    this.renderChart();
  }

  setChartFilter(filter: string): void {
    this.chartFilter = filter;
    this.renderChart();
  }

  switchChartType(type: 'bar' | 'line'): void {
    this.chartType = type;
    this.renderChart();
  }

  togglePreview(): void {
    this.isPreviewMode = !this.isPreviewMode;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.renderChart();
    }, 150);
  }

  /* ------------------- Admin & AI Summary Methods ------------------- */
  buildDefaultExecutiveSummary(): string {
    if (this.isPairwiseCompare && this.currentPair) {
      const diffText = this.pairAvgDiff >= 0 ? `+${this.pairAvgDiff}` : `${this.pairAvgDiff}`;
      return `จากการวิเคราะห์เปรียบเทียบผลการฝึกอบรมหลักสูตร ${this.courseTitle} ระหว่าง ${this.currentPair.prevBatchName} (${this.prevBatchAvg} คะแนน) และ ${this.currentPair.currBatchName} (${this.currBatchAvg} คะแนน) มีผลต่างเฉลี่ยรวม ${diffText} คะแนน โดยมีวิชาที่คะแนนเพิ่มขึ้น ${this.increasedSubjectCount} วิชา และลดลง ${this.decreasedSubjectCount} วิชา จากจำนวนรายวิชาทั้งหมด ${this.subjects.length} วิชา`;
    }
    return `ภาพรวมผลการประเมินการฝึกอบรมหลักสูตร ${this.courseTitle} มีคะแนนเฉลี่ยรวมอยู่ที่ ${this.totalAvg} คะแนน อยู่ในเกณฑ์มาตรฐานคุณภาพการศึกษา`;
  }

  processStatisticalSummary(mode: string, stats: any): { executiveSummary: string; actionPlans: string[] } {
    const isCompare = this.isPairwiseCompare;
    const batch1Name = stats.batch1Name || 'รุ่นก่อนหน้า';
    const batch2Name = stats.batch2Name || 'รุ่นปัจจุบัน';
    const batch1Avg = stats.batch1Avg ? Number(stats.batch1Avg).toFixed(2) : '-';
    const batch2Avg = stats.batch2Avg ? Number(stats.batch2Avg).toFixed(2) : '-';
    const diffVal = stats.diff;
    const diffStr = diffVal !== null && diffVal !== undefined ? (Number(diffVal) >= 0 ? `+${diffVal}` : `${diffVal}`) : '-';
    const increasedCount = stats.increasedCount || 0;
    const decreasedCount = stats.decreasedCount || 0;
    const totalSubjects = stats.totalSubjects || 0;
    const topImproved = stats.topImproved;
    const topDeclined = stats.topDeclined;

    const improvedPercent = totalSubjects > 0 ? ((increasedCount / totalSubjects) * 100).toFixed(1) : '0';
    const declinedPercent = totalSubjects > 0 ? ((decreasedCount / totalSubjects) * 100).toFixed(1) : '0';

    const trendVerb = diffVal && Number(diffVal) > 0
      ? 'มีพัฒนาการในภาพรวมที่เพิ่มขึ้นอย่างชัดเจน'
      : (diffVal && Number(diffVal) < 0
        ? 'มีแนวโน้มผลสัมฤทธิ์ลดลงเล็กน้อยที่ควรได้รับการทบทวน'
        : 'มีผลสัมฤทธิ์ทางการเรียนอยู่ในเกณฑ์มาตรฐานที่ทรงตัว');

    let breakdownDesc = '';
    if (isCompare) {
      if (increasedCount === 0 && decreasedCount === 0 && totalSubjects > 0) {
        breakdownDesc = `ทั้งนี้ เนื่องจาก ${batch2Name} มีการปรับปรุงโครงสร้างรายวิชาใหม่ จึงมีการประเมินผลสัมฤทธิ์บนเกณฑ์ของรายวิชาตามหลักสูตรปัจจุบัน`;
      } else {
        breakdownDesc = `โดยจำแนกเป็นรายวิชาที่มีพัฒนาการเพิ่มขึ้นจำนวน ${increasedCount} วิชา (${improvedPercent}%) และรายวิชาที่คะแนนลดลงจำนวน ${decreasedCount} วิชา (${declinedPercent}%) จากรายวิชาทั้งหมด ${totalSubjects} วิชา`;
      }
    }

    let executiveSummary = '';
    let actionPlans: string[] = [];

    if (mode === 'summarize_short' || this.selectedAiStyle === 'executive') {
      if (isCompare) {
        executiveSummary = `บทสรุปผู้บริหาร: ผลการเปรียบเทียบการฝึกอบรมหลักสูตร ${this.courseTitle} ระหว่าง ${batch1Name} (${batch1Avg} คะแนน) และ ${batch2Name} (${batch2Avg} คะแนน) มีผลต่างคะแนนเฉลี่ยรวมอยู่ที่ ${diffStr} คะแนน ซึ่งสะท้อนว่า ${trendVerb} ${breakdownDesc} ผู้เข้ารับการอบรมมีความพร้อมในการปฏิบัติภารกิจทางทหารตามมาตรฐานหลักสูตร`;
      } else {
        executiveSummary = `บทสรุปผู้บริหาร: ภาพรวมผลการประเมินการฝึกอบรมหลักสูตร ${this.courseTitle} (${this.currentCohortDisplayLabel}) มีคะแนนเฉลี่ยรวม ${batch1Avg !== '-' ? batch1Avg : (batch2Avg !== '-' ? batch2Avg : '90.0')} คะแนน บรรลุเกณฑ์มาตรฐานคุณภาพการศึกษาทางทหารในระดับดีเยี่ยม`;
      }

      actionPlans = [
        '1. รักษามาตรฐานและถอดบทเรียนความสำเร็จเพื่อถ่ายทอดเป็นแนวทางปฏิบัติที่ดี (Best Practice)',
        '2. ติดตามประเมินผลสัมฤทธิ์และการประยุกต์ใช้ทักษะของกำลังพลในการปฏิบัติหน้าที่ ณ หน่วยต้นสังกัด',
        '3. ประสานงานปรับปรุงสื่อการสอนและเครื่องมือสื่อสารให้พร้อมรองรับเทคโนโลยีทางทหารยุคใหม่'
      ];
    } else if (this.selectedAiStyle === 'action') {
      if (isCompare) {
        executiveSummary = `รายงานการวิเคราะห์เชิงปฏิบัติการและการแก้ปัญหา (Action Analysis): จากการประเมินเปรียบเทียบผลการฝึกอบรมหลักสูตร ${this.courseTitle} ระหว่าง ${batch1Name} และ ${batch2Name} พบผลต่างคะแนนเฉลี่ยรวม ${diffStr} คะแนน (ปรับตัวจาก ${batch1Avg} สู่ ${batch2Avg} คะแนน) ${breakdownDesc}\n\nเพื่อยกระดับผลสัมฤทธิ์ทางการศึกษา ฝ่ายวิชาการจึงได้กำหนดมาตรการเชิงรุกในการติดตามและปรับปรุงกระบวนการเรียนรู้ ${topDeclined ? `โดยเฉพาะในรายวิชา "${topDeclined.name}" (${topDeclined.diff} คะแนน) ที่ต้องได้รับการจัดสรรเวลาฝึกปฏิบัติเพิ่มเติม` : 'ในกลุ่มวิชาที่ต้องการการส่งเสริม'}`;
      } else {
        executiveSummary = `รายงานการวิเคราะห์เชิงปฏิบัติการ: หลักสูตร ${this.courseTitle} มีคะแนนเฉลี่ยรวม ${batch1Avg !== '-' ? batch1Avg : '90.0'} คะแนน ฝ่ายวิชาการได้มุ่งเน้นการพัฒนาระบบการเรียนรู้เชิงรุก (Active Learning) เพื่อเสริมสร้างทักษะการปฏิบัติงานจริงของกำลังพลสื่อสาร`;
      }

      actionPlans = [
        '1. [มาตรการเร่งด่วน] จัดการประชุมเชิงปฏิบัติการร่วมกับอาจารย์ผู้สอนเพื่อปรับปรุงแผนการสอนและเพิ่มแบบฝึกหัดเชิงสถานการณ์',
        '2. [การเสริมทักษะ] จัดชั่วโมงติวเสริม (Remedial Classes) และเพิ่มการฝึกปฏิบัติการจริงกับยุทโธปกรณ์สื่อสาร',
        '3. [การประเมินระหว่างทาง] นำระบบ Formative Assessment มาใช้ทดสอบย่อยเพื่อค้นหาจุดบกพร่องของผู้เรียนรายบุคคล',
        '4. [การกำกับดูแล] ติดตามผลการเรียนรู้รายสัปดาห์และรายงานต่อผู้บังคับบัญชาเพื่อปรับแผนการฝึกได้อย่างทันท่วงที'
      ];
    } else {
      if (isCompare) {
        executiveSummary = `จากการวิเคราะห์เปรียบเทียบผลสัมฤทธิ์การฝึกอบรมของหลักสูตร ${this.courseTitle} ระหว่าง ${batch1Name} และ ${batch2Name} พบว่า คะแนนเฉลี่ยรวมปรับตัวจาก ${batch1Avg} คะแนน สู่ ${batch2Avg} คะแนน (${diffStr} คะแนน) ซึ่งสะท้อนว่า ${trendVerb} ${breakdownDesc}`;

        if (topImproved) {
          executiveSummary += `\n\nในมิติด้านจุดแข็งและความโดดเด่นทางวิชาการ รายวิชาที่มีพัฒนาการก้าวกระโดดสูงสุด ได้แก่ "${topImproved.name}" โดยมีคะแนนเฉลี่ยเพิ่มขึ้นถึง +${topImproved.diff} คะแนน แสดงถึงประสิทธิผลของการปรับปรุงกระบวนการถ่ายทอดความรู้และการจัดกิจกรรมการเรียนรู้ที่สอดคล้องกับศักยภาพของผู้เรียนอย่างเด่นชัด ${topDeclined ? `ขณะเดียวกัน ในมิติประเด็นที่ต้องเฝ้าระวัง รายวิชา "${topDeclined.name}" (${topDeclined.diff} คะแนน) จำเป็นต้องได้รับการทบทวนโครงสร้างเนื้อหาและการจัดสรรเวลาฝึกปฏิบัติการเพิ่มเติม` : ''}`;
        }

        executiveSummary += `\n\nสรุปในภาพรวม ผู้เข้ารับการอบรมสามารถบรรลุเกณฑ์สมรรถนะตามมาตรฐานคุณวุฒิของหลักสูตรได้อย่างน่าพึงพอใจ และมีความพร้อมในการนำทักษะด้านการสื่อสารทางทหารไปปฏิบัติหน้าที่ ณ หน่วยขึ้นตรงได้อย่างมีประสิทธิภาพ`;
      } else {
        executiveSummary = `ภาพรวมการประเมินผลการเรียนรู้ของหลักสูตร ${this.courseTitle} (${this.currentCohortDisplayLabel}) มีคะแนนเฉลี่ยรวมอยู่ที่ ${batch1Avg !== '-' ? batch1Avg : (batch2Avg !== '-' ? batch2Avg : '90.0')} คะแนน ซึ่งอยู่ในเกณฑ์ระดับคุณภาพดีเยี่ยม ผู้เข้ารับการอบรมมีผลสัมฤทธิ์ทางการเรียนและทักษะวิชาชีพทางทหารสอดคล้องกับมาตรฐานที่กำหนดไว้`;
      }

      actionPlans = [
        `1. [ด้านหลักสูตร] ถอดบทเรียนและต่อยอดรูปแบบการสอนในรายวิชาที่มีผลสัมฤทธิ์ยอดเยี่ยม (${topImproved ? topImproved.name : 'กลุ่มวิชาที่มีพัฒนาการสูงสุด'}) เพื่อกำหนดเป็นแนวทางปฏิบัติที่ดี (Best Practice)`,
        '2. [ด้านการจัดการเรียนการสอน] ดำเนินการประชุมร่วมกับคณะอาจารย์ผู้สอนเพื่อทบทวนแผนการสอน เพิ่มแบบฝึกหัดเชิงสถานการณ์ และจัดชั่วโมงฝึกปฏิบัติเข้มข้น',
        '3. [ด้านการฝึกปฏิบัติและเครื่องมือ] พัฒนาสื่อการเรียนรู้ดิจิทัลและเพิ่มสัดส่วนการฝึกปฏิบัติการกับเครื่องมือสื่อสารจริง (Hands-on Training)',
        '4. [ด้านการวัดและประเมินผล] จัดให้มีระบบการประเมินความก้าวหน้าระหว่างเรียน (Formative Assessment) แบบต่อเนื่องเพื่อแก้ไขจุดบกพร่องได้ทันท่วงที',
        '5. [ด้านการติดตามผล] ประสานงานกับหน่วยต้นสังกัดเพื่อติดตามผลการปฏิบัติงานจริงของกำลังพลในระยะ 6 เดือน'
      ];
    }

    return { executiveSummary, actionPlans };
  }

  generateWithAi(mode: string = 'generate'): void {
    this.isAiGenerating = true;
    this.saveSuccessMessage = '';
    this.cdr.detectChanges();

    const stats = {
      batch1Name: this.isPairwiseCompare && this.currentPair ? this.currentPair.prevBatchName : (this.displayedBatches[0]?.name || ''),
      batch2Name: this.isPairwiseCompare && this.currentPair ? this.currentPair.currBatchName : '',
      batch1Avg: this.isPairwiseCompare ? this.prevBatchAvg : (this.isSingleView ? this.singleBatchAvg : this.totalAvg),
      batch2Avg: this.isPairwiseCompare ? this.currBatchAvg : 0,
      diff: this.isPairwiseCompare ? this.pairAvgDiff : 0,
      increasedCount: this.increasedSubjectCount,
      decreasedCount: this.decreasedSubjectCount,
      sameCount: this.subjects.length - this.increasedSubjectCount - this.decreasedSubjectCount,
      topImproved: this.currentTopImproved,
      topDeclined: this.currentTopDeclined,
      topSubjects: this.subjects.slice(0, 3).map((s) => ({ name: s.name, score: s.avgScore })),
      bottomSubjects: this.subjects.slice(-3).map((s) => ({ name: s.name, score: s.avgScore })),
      totalSubjects: this.subjects.length,
    };

    setTimeout(() => {
      const result = this.processStatisticalSummary(mode, stats);
      this.adminExecutiveSummary = result.executiveSummary;
      this.adminActionPlanText = result.actionPlans.join('\n');
      this.isAiGenerating = false;
      this.cdr.detectChanges();
    }, 200);
  }

  saveAdminSummary(): void {
    this.isSavingSummary = true;
    const plans = this.adminActionPlanText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      course_name: this.courseTitle,
      cohort_key: this.selectedCohort,
      executive_summary: this.adminExecutiveSummary,
      action_plan: plans,
      updated_by: localStorage.getItem('username') || 'Admin',
    };

    this.courseService.saveTrainingSummary(payload).subscribe({
      next: (res: any) => {
        this.isSavingSummary = false;
        if (res && res.success) {
          this.saveSuccessMessage = 'บันทึกบทสรุปและแผนพัฒนาสู่หน้ารายงานเรียบร้อยแล้ว';
          this.hasSavedSummary = true;
          this.savedExecutiveSummary = this.adminExecutiveSummary;
          this.savedActionPlans = plans;

          setTimeout(() => {
            this.saveSuccessMessage = '';
          }, 3000);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingSummary = false;
        console.error('Error saving summary:', err);
        this.cdr.detectChanges();
      },
    });
  }

  getFilteredChartSubjects(): SubjectItem[] {
    if (this.chartFilter === 'all') {
      return this.subjects;
    }
    if (this.chartFilter === 'top3_prev' && this.currentPair) {
      const pId = this.currentPair.prevBatchId;
      return [...this.subjects]
        .filter((s) => (s.batchScores[pId] || 0) > 0)
        .sort((a, b) => (b.batchScores[pId] || 0) - (a.batchScores[pId] || 0))
        .slice(0, 3);
    }
    if (this.chartFilter === 'bottom3_prev' && this.currentPair) {
      const pId = this.currentPair.prevBatchId;
      return [...this.subjects]
        .filter((s) => (s.batchScores[pId] || 0) > 0)
        .sort((a, b) => (a.batchScores[pId] || 0) - (b.batchScores[pId] || 0))
        .slice(0, 3);
    }
    if (this.chartFilter === 'top3_curr' && this.currentPair) {
      const cId = this.currentPair.currBatchId;
      return [...this.subjects]
        .filter((s) => (s.batchScores[cId] || 0) > 0)
        .sort((a, b) => (b.batchScores[cId] || 0) - (a.batchScores[cId] || 0))
        .slice(0, 3);
    }
    if (this.chartFilter === 'bottom3_curr' && this.currentPair) {
      const cId = this.currentPair.currBatchId;
      return [...this.subjects]
        .filter((s) => (s.batchScores[cId] || 0) > 0)
        .sort((a, b) => (a.batchScores[cId] || 0) - (b.batchScores[cId] || 0))
        .slice(0, 3);
    }
    if (this.chartFilter === 'top3') {
      return [...this.subjects]
        .filter((s) => s.avgScore > 0)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 3);
    }
    if (this.chartFilter === 'bottom3') {
      return [...this.subjects]
        .filter((s) => s.avgScore > 0)
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 3);
    }
    return this.subjects;
  }

  renderChart(): void {
    const ctx = document.getElementById('mainChart') as HTMLCanvasElement;
    if (!ctx || this.subjects.length === 0) {
      if (this.mainChart) {
        this.mainChart.destroy();
        this.mainChart = null;
      }
      return;
    }

    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }

    const chartSubjects = this.getFilteredChartSubjects();
    const labels = chartSubjects.map((s) => s.name);
    const datasets: any[] = [];
    const activeBatches = this.displayedBatches;

    activeBatches.forEach((batch, idx) => {
      let bg = this.palette[idx % this.palette.length].bg;
      let border = this.palette[idx % this.palette.length].border;

      if (this.isPairwiseCompare) {
        if (idx === 0) {
          bg = '#94a3b8';
          border = '#64748b';
        } else {
          bg = '#3b82f6';
          border = '#2563eb';
        }
      }

      datasets.push({
        label: batch.name,
        data: chartSubjects.map((s) => {
          const val = s.batchScores[batch.id];
          return val !== null && val !== undefined ? val : 0;
        }),
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1.5,
        borderRadius: 4,
        fill: false,
        tension: 0.3,
      });
    });

    this.mainChart = new Chart(ctx, {
      type: this.chartType,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item: any) => `${item.dataset.label}: ${item.parsed.y} คะแนน`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: {
              color: '#f1f5f9',
            },
            ticks: {
              font: {
                family: 'Sarabun',
              },
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                family: 'Sarabun',
                size: 11,
              },
              maxRotation: 45,
              minRotation: 25,
            },
          },
        },
      },
    });
  }

  getBatchScore(subject: SubjectItem, batchId: number): string {
    const val = subject.batchScores[batchId];
    return val !== null && val !== undefined ? String(val) : '-';
  }

  getBatchScoreNumber(subject: SubjectItem, batchId: number): number | null {
    const val = subject.batchScores[batchId];
    return val !== null && val !== undefined ? val : null;
  }

  getBatchColorClass(batchId: number): string {
    if (this.isPairwiseCompare && this.currentPair) {
      if (batchId === this.currentPair.prevBatchId) return 'slate';
      if (batchId === this.currentPair.currBatchId) return 'blue';
    }
    const idx = this.batches.findIndex((b) => b.id === batchId);
    return this.palette[(idx >= 0 ? idx : 0) % this.palette.length].class;
  }

  goBack(): void {
    if (this.isAdmin) {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
