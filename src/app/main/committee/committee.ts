import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { GeneralEvaluationService } from '../../services/general-evaluation.service';

@Component({
  selector: 'app-committee',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './committee.html',
  styleUrl: './committee.scss',
})
export class Committee implements OnInit, OnDestroy {
  pageTitle: string = 'แบบประเมินสำหรับคณะกำกับหลักสูตร';
  currentBatchId: number | null = null;
  courseName: string = '';
  batchName: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.currentBatchId = params['batchId'] ? Number(params['batchId']) : null;
      this.courseName = params['courseName'] || params['title'] || '';
      this.batchName = params['batchName'] || '';
    });
  }

  goToForm(): void {
    if (!this.currentBatchId) {
      alert('ไม่พบข้อมูลรุ่น กรุณาเข้าสู่ระบบใหม่หรือเลือกรุ่นที่ต้องการประเมิน');
      return;
    }

    this.router.navigate(['/student/fill-form'], {
      queryParams: {
        type: 'committee',
        batchId: this.currentBatchId,
        batchName: this.batchName,
        courseTitle: this.courseName,
      }
    });
  }
}
