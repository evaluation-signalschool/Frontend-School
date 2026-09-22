import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './teacher.html',
  styleUrl: './teacher.scss',
})
export class Teacher {
  courseName: string = '';
  batchName: string = '';
  currentBatchId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

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

    this.router.navigate(['/teacher/fill-form'], {
      queryParams: {
        type: 'teacher_course',
        batchId: this.currentBatchId,
        batchName: this.batchName,
        courseTitle: this.courseName,
      }
    });
  }
}
