import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-training-results',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './training-results.html',
  styleUrl: './training-results.scss',
})
export class TrainingResults {
  // 2. Inject Router ผ่าน Constructor
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/']);
  }

  // ในไฟล์ .ts
  selectMenu(menuType: string): void {
    this.router.navigate(['/training-results/training-summary'], { queryParamsHandling: 'preserve' });
  }
}
