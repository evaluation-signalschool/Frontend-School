import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-follow-up',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './follow-up.html',
  styleUrls: ['./follow-up.scss']
})
export class FollowUpComponent implements OnInit {
  courseName: string = '';
  batchId: number | null = null;
  batchName: string = '';

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.courseName = params['courseName'] || params['title'] || '';
      this.batchId = params['batchId'] ? Number(params['batchId']) : null;
      this.batchName = params['batchName'] || '';
    });
  }

  goToForm(formType: string): void {
    if (!this.batchId) {
      alert('ไม่พบข้อมูลรุ่น กรุณาเข้าสู่ระบบใหม่หรือเลือกรุ่นที่ต้องการประเมิน');
      return;
    }

    this.router.navigate(['/student/fill-form'], {
      queryParams: {
        type: formType,
        batchId: this.batchId,
        batchName: this.batchName,
        courseTitle: this.courseName,
      }
    });
  }
}
