import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminLayoutService {
  private collapsedSubject = new BehaviorSubject<boolean>(false);
  private mobileOpenSubject = new BehaviorSubject<boolean>(false);

  isCollapsed$ = this.collapsedSubject.asObservable();
  isMobileOpen$ = this.mobileOpenSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_sidebar_collapsed');
      if (saved !== null) {
        this.collapsedSubject.next(saved === 'true');
      }
    }
  }

  get isCollapsed(): boolean {
    return this.collapsedSubject.value;
  }

  get isMobileOpen(): boolean {
    return this.mobileOpenSubject.value;
  }

  toggleCollapse(): void {
    const next = !this.collapsedSubject.value;
    this.collapsedSubject.next(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_sidebar_collapsed', String(next));
    }
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsedSubject.next(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
    }
  }

  toggleMobile(): void {
    this.mobileOpenSubject.next(!this.mobileOpenSubject.value);
  }

  openMobile(): void {
    this.mobileOpenSubject.next(true);
  }

  closeMobile(): void {
    this.mobileOpenSubject.next(false);
  }
}
