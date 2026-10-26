import { Component, ViewChild, ElementRef } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, inject } from '@angular/core';
import { Chart, registerables, ChartType, ChartDataset } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../environments/environment';
import { CourseService } from '../services/course.service';

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

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterModule, MatButtonModule, FormsModule, MatSelectModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  animations: [
    trigger('slideAnim', [
      transition(':enter', [
        style({ opacity: 0 }), // กำหนดค่าความโปร่งใสเริ่มต้น
        animate('500ms ease', style({ opacity: 1 })), // แอนิเมชันแสดงผลแบบค่อยๆ ปรากฏ
      ]),
      transition(':leave', [
        // การเปลี่ยนสถานะของแอนิเมชัน (Transition)
        animate('500ms ease', style({ opacity: 0 })),
      ]),
    ]),
  ],
})
export class Home {
  @ViewChild('contentRef') contenRef!: ElementRef;

  // ── Slideshow ─────────────────────────────────────
  slides = [
    { image: 'assets/image/image1.png', caption: 'Caption Text' },
    { image: 'assets/image/image2.png', caption: 'Caption Two' },
    { image: 'assets/image/image3.png', caption: 'Caption Three' },
  ];

  currentIndex = 0;
  private autoPlayTimer: any;

  private cdr = inject(ChangeDetectorRef);

  nextSlide() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.resetTimer();
  }

  prevSlide() {
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.resetTimer();
  }

  goToSlide(index: number) {
    this.currentIndex = index;
    this.resetTimer();
  }

  private startAutoPlay() {
    this.autoPlayTimer = setInterval(() => this.nextSlide(), 4000);
  }

  private resetTimer() {
    clearInterval(this.autoPlayTimer);
    this.startAutoPlay();
  }

  // ── Scrollspy ─────────────────────────────────────
  activeSection = 'home';

  sections = [
    { id: 'sec-home', key: 'home' },
    { id: 'sec-news', key: 'news' },
    { id: 'sec-dashboard', key: 'dashboard' },
    { id: 'sec-about', key: 'about' },
    { id: 'sec-forms', key: 'forms' }
  ];
  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  onScroll() {
    const el = this.contenRef.nativeElement;
    const scrollTop = el.scrollTop;
    const height = el.clientHeight;
    const scrollHeight = el.scrollHeight;

    // หากเลื่อนจนสุดขอบล่างสุดของพื้นที่สกรอล ให้ไฮไลท์เมนูหัวข้อสุดท้าย (แบบฟอร์มคำร้อง) เสมอ
    if (scrollTop + height >= scrollHeight - 10) {
      this.activeSection = this.sections[this.sections.length - 1].key;
      return;
    }

    let current = this.sections[0].key;
    this.sections.forEach((sec) => {
      const target = document.getElementById(sec.id);
      if (target && target.offsetTop - height * 0.4 <= scrollTop) {
        current = sec.key;
      }
    });
    this.activeSection = current;
  }

  // ── Training Statistics ─────────────────────────────────────
  private courseService = inject(CourseService);

  public isLoadingTrainingStats = false;
  public availableCourses: any[] = [];
  public selectedCourseName: string = '';
  public courseTitle: string = '';
  public batches: BatchItem[] = [];
  public subjects: SubjectItem[] = [];
  public pairwiseComparisons: PairwiseComparisonItem[] = [];
  public totalAvg: number = 0;
  public topImproved: { name: string; diff: number } | null = null;
  public topDeclined: { name: string; diff: number } | null = null;
  public actionPlans: string[] = [];
  public savedActionPlans: string[] = [];
  public hasSavedSummary: boolean = false;

  public selectedCohort: string = 'all';
  public currentAverageScore: number = 0;
  public chart: Chart | null = null;
  public chartType: ChartType = 'bar';

  private chartPalette = [
    { bg: '#3b82f6', border: '#2563eb' }, // Blue
    { bg: '#8b5cf6', border: '#7c3aed' }, // Purple
    { bg: '#10b981', border: '#059669' }, // Green
    { bg: '#f59e0b', border: '#d97706' }, // Amber
    { bg: '#ec4899', border: '#db2777' }, // Pink
    { bg: '#06b6d4', border: '#0891b2' }, // Cyan
  ];

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
      const id = Number(this.selectedCohort.split(':')[1]);
      const found = this.batches.find((b) => b.id === id);
      return found ? [found] : this.batches;
    }
    return this.batches;
  }

  loadTrainingSummary(courseId?: number, courseName?: string): void {
    this.isLoadingTrainingStats = true;
    this.courseService.getTrainingSummary(courseId, courseName).subscribe({
      next: (res: any) => {
        this.isLoadingTrainingStats = false;
        if (res && res.success && res.course) {
          this.availableCourses = res.availableCourses || [];
          this.courseTitle = res.course.name || '';
          this.selectedCourseName = res.course.name || '';
          this.batches = (res.batches || []).map((b: any) => ({
            id: b.id || b.batch_id,
            name: b.name || b.batch_name,
            startDate: b.startDate || b.start_date,
            endDate: b.endDate || b.end_date,
            isActive: Boolean(b.isActive || b.is_active)
          }));
          this.subjects = res.subjects || [];
          this.pairwiseComparisons = res.pairwiseComparisons || [];
          this.totalAvg = res.totalAvg || 0;
          this.topImproved = res.topImproved || null;
          this.topDeclined = res.topDeclined || null;
          this.actionPlans = res.actionPlans || [];

          if (this.batches.length > 1) {
            this.selectedCohort = 'all';
          } else if (this.batches.length === 1) {
            this.selectedCohort = 'single:' + this.batches[0].id;
          } else {
            this.selectedCohort = 'all';
          }

          this.updateAverageScore();
          this.loadSavedSummary();
          this.cdr.detectChanges();
          setTimeout(() => {
            this.createChart();
          }, 150);
        }
      },
      error: (err) => {
        this.isLoadingTrainingStats = false;
        console.error('Error loading training statistics for dashboard:', err);
      }
    });
  }

  loadSavedSummary(): void {
    if (!this.courseTitle || !this.selectedCohort) return;
    this.courseService.getSavedTrainingSummary(this.courseTitle, this.selectedCohort).subscribe({
      next: (res: any) => {
        if (res && res.success && res.hasData && res.data) {
          this.hasSavedSummary = true;
          this.savedActionPlans = res.data.action_plan || [];
        } else {
          this.hasSavedSummary = false;
          this.savedActionPlans = [];
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  public onCourseChange(): void {
    if (this.selectedCourseName) {
      this.loadTrainingSummary(undefined, this.selectedCourseName);
    }
  }

  public onCohortChange(): void {
    this.updateAverageScore();
    this.loadSavedSummary();
    this.createChart();
  }

  updateAverageScore(): void {
    if (!this.selectedCohort || this.selectedCohort === 'all') {
      this.currentAverageScore = this.totalAvg;
      return;
    }
    if (this.selectedCohort.startsWith('single:')) {
      const bId = Number(this.selectedCohort.split(':')[1]);
      const scores = this.subjects
        .map(s => s.batchScores[bId])
        .filter((v): v is number => v !== null && v !== undefined && v > 0);
      this.currentAverageScore = scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : 0;
      return;
    }
    if (this.selectedCohort.startsWith('compare:')) {
      const parts = this.selectedCohort.split(':');
      const currId = Number(parts[2]);
      const scores = this.subjects
        .map(s => s.batchScores[currId])
        .filter((v): v is number => v !== null && v !== undefined && v > 0);
      this.currentAverageScore = scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : this.totalAvg;
      return;
    }
    this.currentAverageScore = this.totalAvg;
  }

  public createChart(): void {
    const ctx = document.getElementById('mainChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (this.subjects.length === 0 || this.displayedBatches.length === 0) {
      return;
    }

    const labels = this.subjects.map(s => s.name);
    const datasets: any[] = [];
    const activeBatches = this.displayedBatches;

    activeBatches.forEach((batch, idx) => {
      const color = this.chartPalette[idx % this.chartPalette.length];
      datasets.push({
        label: batch.name,
        data: this.subjects.map(s => {
          const val = s.batchScores[batch.id];
          return val !== null && val !== undefined ? val : 0;
        }),
        backgroundColor: this.chartType === 'line' ? 'transparent' : color.bg,
        borderColor: color.border,
        borderWidth: 2,
        borderRadius: 6,
        fill: false,
        tension: 0.35,
        pointBackgroundColor: color.border,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    });

    this.chart = new Chart(ctx, {
      type: this.chartType,
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8,
            titleFont: { family: 'Sarabun' },
            bodyFont: { family: 'Sarabun' },
            callbacks: {
              label: (item: any) => `${item.dataset.label}: ${item.parsed.y} คะแนน`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: {
              color: '#f1f5f9'
            },
            ticks: {
              stepSize: 20,
              font: { family: 'Sarabun' }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { family: 'Sarabun', size: 12 },
              maxRotation: 45,
              minRotation: 0
            }
          }
        }
      }
    });
  }

  public switchChartType(type: 'bar' | 'line'): void {
    if (this.chartType === type) return;
    this.chartType = type as ChartType;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
      this.createChart();
    }
  }

  getBatchColor(idx: number): string {
    return this.chartPalette[idx % this.chartPalette.length].bg;
  }

  getSubjectDiff(subject: SubjectItem): number | null {
    if (this.selectedCohort.startsWith('compare:')) {
      const parts = this.selectedCohort.split(':');
      const prevId = Number(parts[1]);
      const currId = Number(parts[2]);
      const prevScore = subject.batchScores[prevId];
      const currScore = subject.batchScores[currId];
      if (prevScore !== null && prevScore !== undefined && currScore !== null && currScore !== undefined) {
        return Number((currScore - prevScore).toFixed(1));
      }
      return null;
    }
    return subject.diff;
  }

  getTrendClass(subject: SubjectItem): string {
    const diff = this.getSubjectDiff(subject);
    if (diff === null || diff === undefined) return '';
    return diff > 0 ? 'trend up' : diff < 0 ? 'trend down' : '';
  }

  getTrendText(subject: SubjectItem): string {
    const diff = this.getSubjectDiff(subject);
    if (diff === null || diff === undefined) return '-';
    if (diff > 0) return `▲ เพิ่มขึ้น (+${diff})`;
    if (diff < 0) return `▼ ลดลง (${diff})`;
    return '- เท่าเดิม';
  }

  get displayedActionPlans(): string[] {
    if (this.savedActionPlans && this.savedActionPlans.length > 0) {
      return this.savedActionPlans;
    }
    if (this.actionPlans && this.actionPlans.length > 0) {
      return this.actionPlans;
    }
    const plans: string[] = [];
    if (this.topDeclined) {
      plans.push(`โครงการส่งเสริมทักษะวิชา ${this.topDeclined.name}: เพิ่มชั่วโมงฝึกปฏิบัติการและทบทวนเนื้อหาเนื่องจากมีแนวโน้มคะแนนลดลง (${this.topDeclined.diff} คะแนน)`);
    }
    if (this.topImproved) {
      plans.push(`กิจกรรมขยายผลความสำเร็จวิชา ${this.topImproved.name}: จัดกิจกรรมนำแนวการเรียนรู้ที่คะแนนเพิ่มขึ้น (+${this.topImproved.diff} คะแนน) มาเป็นต้นแบบ`);
    }
    if (plans.length === 0) {
      plans.push('ส่งเสริมการเรียนรู้ผ่านสื่อดิจิทัลและแบบฝึกหัดทบทวนรายวิชาเพื่อรักษามาตรฐานผลการเรียนอย่างต่อเนื่อง');
    }
    return plans;
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.createChart();
    }, 200);
  }


  // ── Lifecycle ─────────────────────────────────────
  ngOnDestroy() {
    clearInterval(this.autoPlayTimer);
  }

  // ── about ─────────────────────────────────────
  staffList: { image: string; name: string; rank: string }[] = [];

  itemsPerPage = 4;
  staffPage = 0;

  constructor(private http: HttpClient) {}
  ngOnInit() {
    this.http
      .get<{ image: string; name: string; rank: string }[]>('assets/data/staff-list.json')
      .subscribe((data) => {
        this.staffList = data;
        this.staffPage = 0; // reset หน้าให้เริ่มที่ 0 ทุกครั้งที่โหลดใหม่
        this.cdr.detectChanges();
      });

    this.startAutoPlay();
    this.fetchNews();
    this.loadTrainingSummary();
  }

  // ดึงข้อมูลรายชื่อเจ้าหน้าที่แบบแบ่งหน้า
  get staffGroups(): number[] {
    return Array.from(
      { length: Math.ceil(this.staffList.length / this.itemsPerPage) },
      (_, i) => i,
    );
  }

  get currentStaff() {
    const start = this.staffPage * this.itemsPerPage;
    return this.staffList.slice(start, start + this.itemsPerPage); // ส่งคืนข้อมูลตามจำนวนรายการต่อหน้า
  }

  // ── Forms List ─────────────────────────────────────
  forms = [
    {
      title: 'ระเบียบการประเมินผลและสถิติ',
      viewUrl: 'https://drive.google.com/file/d/1BurvrsGLMCjFjTkd-1bkF55JwYoRBLJ9/view',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=1BurvrsGLMCjFjTkd-1bkF55JwYoRBLJ9'
    },
    {
      title: 'แบบฟอร์มร้องขอ ขออนุมัติสอบย้อนหลัง/สอบแก้ตัว',
      viewUrl: 'https://drive.google.com/file/d/1BurvrsGLMCjFjTkd-1bkF55JwYoRBLJ9/view',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=1BurvrsGLMCjFjTkd-1bkF55JwYoRBLJ9'
    }
  ];

  viewForm(url: string) {
    if (url) {
      window.open(url, '_blank');
    }
  }

  // ── News List ─────────────────────────────────────
  newsList: any[] = [];

  getTypeLabel(type: string): string {
    switch(type) {
      case 'announce': return '📣 ประกาศ';
      case 'news': return '📰 ข่าวสาร';
      case 'activity': return '🎓 กิจกรรม';
      default: return '📣 ประกาศ';
    }
  }

  fetchNews() {
    this.http.get<any>(`${environment.apiUrl}/news`).subscribe({
      next: (res) => {
        if (res.success) {
          this.newsList = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to fetch news', err)
    });
  }

  getBackendUrl() {
    return environment.apiUrl.replace(/\/api\/?$/, '');
  }

  getFileUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return this.getBackendUrl() + url;
  }

  isGoogleDrive(url: string): boolean {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  }
}

