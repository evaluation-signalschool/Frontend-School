import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-training-statistics',
  standalone: true, 
  imports: [FormsModule, MatSelectModule], 
  templateUrl: './training-statistics.html',
  styleUrl: './training-statistics.scss',
})
export class TrainingStatistics implements OnInit {// State Variables
  selectedCohort: string = 'all';
  chartType: 'bar' | 'line' = 'bar';
  mainChart: any;
  courseName: string = 'ชั้นนายพัน เหล่า ส.';

  // Data Source สำหรับแสดงผลกราฟ
  chartData = {
    labels: ['การยิงปืนประจำกาย', 'ยุทธวิธีระดับหมวด', 'วิชาสื่อสารและเรดาร์', 'วิชาการต้นแบบอาวุธ'],
    datasets: [
      {
        label: 'รุ่นที่ 1',
        data: [88, 82, 72, 68],
        backgroundColor: '#93c5fd',
        borderColor: '#93c5fd',
        fill: false,
        tension: 0.3
      },
      {
        label: 'รุ่นที่ 2',
        data: [91, 87, 65, 65],
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        fill: false,
        tension: 0.3
      },
    ]
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params: any) => {
      if (params['course']) {
        this.courseName = params['course'];
      }
    });
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  // ฟังก์ชันสร้างและเรนเดอร์กราฟ
  renderChart(): void {
    const ctx = document.getElementById('mainChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.mainChart) {
      this.mainChart.destroy(); // ลบ Canvas เดิมออกก่อนสร้างใหม่เพื่อป้องกันกราฟซ้อน
    }

    this.mainChart = new Chart(ctx, {
      type: this.chartType,
      data: this.chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // ซ่อน legend หลักเนื่องจากมี Custom Legend ใน HTML แล้ว
          }
        },
        scales: {
          y: {
            min: 40,
            max: 100,
            grid: {
              color: '#f1f5f9'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // ฟังก์ชันสลับการแสดงผลกราฟ (Bar / Line)
  switchChartType(type: 'bar' | 'line'): void {
    this.chartType = type;
    this.renderChart();
  }

  // Event Handler เมื่อมีการเปลี่ยนรุ่นผ่าน Dropdown
  onCohortChange(): void {
    console.log('Selected Cohort:', this.selectedCohort);
    // TODO: สามารถเพิ่ม Logic การดึงข้อมูลแยกตามรุ่นมาอัปเดตกราฟตรงนี้ได้เพิ่มเติม
  }

}
