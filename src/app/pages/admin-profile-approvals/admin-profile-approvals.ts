import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-profile-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-profile-approvals.html',
  styleUrl: './admin-profile-approvals.scss'
})
export class AdminProfileApprovals implements OnInit {
  requests: any[] = [];
  isLoading: boolean = true;
  apiUrl = environment.apiUrl;

  // Filter & Search
  searchQuery: string = '';
  selectedStatus: 'all' | 'pending' | 'approved' | 'rejected' = 'all';

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [10, 25, 50];

  constructor(private http: HttpClient, private location: Location, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.fetchRequests();
  }

  fetchRequests(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/edit-profile/requests`).subscribe({
      next: (res) => {
        this.requests = res || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching requests', err);
        this.isLoading = false;
        this.cdr.detectChanges();
        const msg = err.error?.message || 'ไม่สามารถดึงข้อมูลคำร้องได้';
        Swal.fire('ข้อผิดพลาด', msg, 'error');
      }
    });
  }

  // Counter getters
  get pendingCount(): number {
    return this.requests.filter(r => r.status === 'pending').length;
  }

  get approvedCount(): number {
    return this.requests.filter(r => r.status === 'approved').length;
  }

  get rejectedCount(): number {
    return this.requests.filter(r => r.status === 'rejected').length;
  }

  // Filter & Sort ("ของล่าสุดขึ้นก่อน" & "รออนุมัติขึ้นก่อน")
  get filteredRequests(): any[] {
    let list = [...this.requests];

    // กรองตามแท็บสถานะ
    if (this.selectedStatus !== 'all') {
      list = list.filter(r => r.status === this.selectedStatus);
    }

    // กรองตามช่องค้นหา
    const query = (this.searchQuery || '').trim().toLowerCase();
    if (query) {
      list = list.filter(r => {
        const studentCode = String(r.student_code || '').toLowerCase();
        const origName = `${r.original_rank || ''}${r.original_first_name || ''} ${r.original_last_name || ''}`.toLowerCase();
        const newName = `${r.new_rank || ''}${r.new_first_name || ''} ${r.new_last_name || ''}`.toLowerCase();
        const course = String(r.course_name || '').toLowerCase();
        const batch = String(r.batch_name || r.batch_id || '').toLowerCase();
        return (
          studentCode.includes(query) ||
          origName.includes(query) ||
          newName.includes(query) ||
          course.includes(query) ||
          batch.includes(query)
        );
      });
    }

    // จัดเรียง: 1. รออนุมัติ (pending) ขึ้นก่อนเสมอ 2. วันที่ล่าสุดขึ้นก่อน (created_at DESC)
    return list.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;

      const timeA = new Date(a.created_at).getTime() || 0;
      const timeB = new Date(b.created_at).getTime() || 0;
      return timeB - timeA;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRequests.length / this.pageSize));
  }

  get paginatedRequests(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredRequests.slice(startIndex, startIndex + this.pageSize);
  }

  setStatusFilter(status: 'all' | 'pending' | 'approved' | 'rejected'): void {
    this.selectedStatus = status;
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getStartIndex(): number {
    if (this.filteredRequests.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredRequests.length);
  }

  viewedRequestIds = new Set<number>();

  isGoogleDrive(documentPath: string): boolean {
    if (!documentPath) return false;
    try {
      const parsed = JSON.parse(documentPath);
      if (parsed.provider === 'google_drive') return true;
      if (parsed.url && (parsed.url.includes('drive.google.com') || parsed.url.includes('docs.google.com'))) return true;
    } catch (_) {
      if (documentPath.includes('drive.google.com') || documentPath.includes('docs.google.com')) return true;
    }
    return false;
  }

  viewDocument(documentPath: string, reqId?: number): void {
    if (!documentPath) {
      Swal.fire('ไม่มีเอกสาร', 'ผู้ใช้นี้ไม่ได้แนบเอกสารมาด้วย', 'info');
      return;
    }
    
    if (reqId) {
      this.viewedRequestIds.add(reqId);
      this.cdr.detectChanges();
    }

    let url = '';
    try {
      const docData = JSON.parse(documentPath);
      if (docData && docData.url) {
        url = docData.url;
      } else {
        throw new Error('Invalid JSON format');
      }
    } catch (e) {
      if (documentPath.startsWith('http://') || documentPath.startsWith('https://')) {
        url = documentPath;
      } else {
        const backendBaseUrl = this.apiUrl.replace('/api', '');
        url = `${backendBaseUrl}/uploads/${documentPath}`;
      }
    }

    if (!url) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบลิงก์สำหรับเปิดเอกสาร', 'error');
      return;
    }
    
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  updateStatus(id: number, status: 'approved' | 'rejected'): void {
    // กฎธุรกิจ: หากมีเอกสารแนบ ต้องเปิดดูเอกสารหลักฐานก่อน จึงจะกดยืนยันอนุมัติหรือไม่อนุมัติได้
    const req = this.requests.find((r) => r.id === id);
    if (req && req.document_path && !this.viewedRequestIds.has(id)) {
      Swal.fire({
        icon: 'warning',
        title: 'ยังไม่ได้เปิดดูเอกสาร',
        text: 'กรุณาเปิดดูเอกสารหลักฐานก่อนดำเนินการ',
        confirmButtonColor: '#0284c7',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    const actionText = status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ';
    const confirmColor = status === 'approved' ? '#4caf50' : '#f44336';

    Swal.fire({
      title: `ยืนยันการ${actionText}?`,
      text: `คุณต้องการ${actionText}คำร้องนี้ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#757575',
      confirmButtonText: `ยืนยัน${actionText}`,
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.put(`${this.apiUrl}/edit-profile/requests/${id}`, { status }).subscribe({
          next: () => {
            Swal.fire('สำเร็จ!', `ทำรายการ${actionText}เรียบร้อยแล้ว`, 'success');
            this.fetchRequests();
          },
          error: (err) => {
            console.error(err);
            Swal.fire('ข้อผิดพลาด', `ไม่สามารถ${actionText}ได้`, 'error');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  deleteRequest(id: number): void {
    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'คุณต้องการลบข้อมูลคำร้องนี้ออกจากระบบใช่หรือไม่? (ลบแล้วกู้คืนไม่ได้)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#757575',
      confirmButtonText: 'ยืนยันลบ',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${this.apiUrl}/edit-profile/requests/${id}`).subscribe({
          next: () => {
            Swal.fire('ลบสำเร็จ!', 'ข้อมูลคำร้องถูกลบออกจากระบบแล้ว', 'success');
            this.fetchRequests();
          },
          error: (err) => {
            console.error(err);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้', 'error');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
