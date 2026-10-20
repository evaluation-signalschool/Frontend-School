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

  // 1. ประกาศตัวแปรสำหรับกราฟ
  public chart: Chart | null = null;
  public chartType: ChartType = 'bar';

  public chartLabels: string[] = [];
  public chartDatasets: ChartDataset[] = [];

  // กำหนดตัวแปรสำหรับแสดงผลในหน้าจอ
  public selectedCohort: string = 'all'; 
  public currentAverageScore: number = 77.5; // ตัวแปรเก็บคะแนนเฉลี่ยที่ใช้แสดงใน HTML

  // ข้อมูลคะแนนเฉลี่ยจำลองของแต่ละรุ่น
  private cohortScores: { [key: string]: number } = {
    'all': 77.5,
    '1': 77.5,
    '2': 77.0,
    '3': 77.3
  };

  ngAfterViewInit(): void {
    this.createChart();
  }

  // 3. ฟังก์ชันนี้ต้องเป็น public และชื่อตรงกับใน HTML
  public onCohortChange(): void {
    this.currentAverageScore = this.cohortScores[this.selectedCohort] || 0;
  }

  public createChart(): void {
  const ctx = document.getElementById('mainChart') as HTMLCanvasElement;
  if (!ctx) return;

  // เคลียร์กราฟเดิมออกจาก Canvas ก่อนสร้างใหม่ เพื่อป้องกันข้อผิดพลาด Canvas is already in use
  if (this.chart) {
    this.chart.destroy();
  }
  // หรือใช้บรรทัดนี้ชัวร์ที่สุด: Chart.getChart(ctx)?.destroy();

  this.chart = new Chart(ctx, {
    type: this.chartType,
    data: {
      // ดึงข้อมูลจากตัวแปร เพื่อป้องกันข้อมูลสูญหายเมื่อสลับกราฟหรือเรียก API
      labels: this.chartLabels || [], 
      datasets: this.chartDatasets || []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

  // 3. ฟังก์ชันสลับประเภทกราฟ
  public switchChartType(type: 'bar' | 'line'): void {
    if (this.chartType === type) return;
    this.chartType = type as ChartType;

    if (this.chart) {
      this.chart.destroy();
      this.createChart();
    }
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

