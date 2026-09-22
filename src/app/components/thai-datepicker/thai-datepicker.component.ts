import {
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface CalendarDay {
  day: number;
  monthOffset: number; // -1 = prev month, 0 = current month, 1 = next month
  date: Date;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-thai-datepicker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './thai-datepicker.component.html',
  styleUrls: ['./thai-datepicker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ThaiDatePickerComponent),
      multi: true
    }
  ]
})
export class ThaiDatePickerComponent implements OnInit, ControlValueAccessor {
  @Input() placeholder: string = 'วว/ดด/ปปปป (พ.ศ.)';
  @Input() disabled: boolean = false;
  @Input() id: string = '';
  @Input() name: string = '';

  isOpen: boolean = false;
  displayText: string = '';
  innerValue: string = ''; // ISO 'YYYY-MM-DD'

  // ปฏิทินแสดงเดือนและปี พ.ศ.
  viewMonth: number = 0; // 0-11
  viewYearBE: number = 2569; // พ.ศ.

  readonly thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  readonly weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  availableYears: number[] = [];
  calendarDays: CalendarDay[] = [];

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    const today = new Date();
    this.viewMonth = today.getMonth();
    this.viewYearBE = today.getFullYear() + 543;

    // สร้างช่วงปี พ.ศ. 2540 - 2585
    const startYear = 2540;
    const endYear = 2585;
    for (let y = startYear; y <= endYear; y++) {
      this.availableYears.push(y);
    }

    this.generateCalendarDays();
  }

  // --- ControlValueAccessor Methods ---
  writeValue(value: any): void {
    if (value) {
      // อาจส่งมาเป็น '2026-09-09' หรือ '2026-09-09T00:00:00.000Z'
      const dateStr = String(value).split('T')[0];
      this.innerValue = dateStr;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const beYear = y < 2500 ? y + 543 : y;
          this.displayText = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${beYear}`;
          this.viewMonth = m - 1;
          this.viewYearBE = beYear;
          this.generateCalendarDays();
          return;
        }
      }
    }
    this.innerValue = '';
    this.displayText = '';
    this.generateCalendarDays();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // --- Calendar Popup Toggle & Close ---
  toggleCalendar(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      if (this.innerValue) {
        const parts = this.innerValue.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          this.viewYearBE = y < 2500 ? y + 543 : y;
          this.viewMonth = m - 1;
        }
      }
      this.generateCalendarDays();
    }
  }

  closeCalendar(): void {
    this.isOpen = false;
    this.onTouched();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeCalendar();
    }
  }

  // --- Calendar Navigation ---
  prevMonth(): void {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYearBE--;
    } else {
      this.viewMonth--;
    }
    this.generateCalendarDays();
  }

  nextMonth(): void {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYearBE++;
    } else {
      this.viewMonth++;
    }
    this.generateCalendarDays();
  }

  onMonthChange(newMonth: any): void {
    this.viewMonth = parseInt(newMonth, 10);
    this.generateCalendarDays();
  }

  onYearChange(newYear: any): void {
    this.viewYearBE = parseInt(newYear, 10);
    this.generateCalendarDays();
  }

  // --- Generate Calendar Grid ---
  generateCalendarDays(): void {
    const ceYear = this.viewYearBE - 543;
    const firstDay = new Date(ceYear, this.viewMonth, 1).getDay();
    const daysInMonth = new Date(ceYear, this.viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(ceYear, this.viewMonth, 0).getDate();

    const today = new Date();
    const todayCEYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    // Selected date components
    let selY = -1;
    let selM = -1;
    let selD = -1;
    if (this.innerValue) {
      const parts = this.innerValue.split('-');
      if (parts.length === 3) {
        selY = parseInt(parts[0], 10);
        selM = parseInt(parts[1], 10) - 1;
        selD = parseInt(parts[2], 10);
      }
    }

    const days: CalendarDay[] = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const d = new Date(ceYear, this.viewMonth - 1, day);
      days.push({
        day,
        monthOffset: -1,
        date: d,
        isToday: d.getFullYear() === todayCEYear && d.getMonth() === todayMonth && d.getDate() === todayDate,
        isSelected: d.getFullYear() === selY && d.getMonth() === selM && d.getDate() === selD
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(ceYear, this.viewMonth, i);
      days.push({
        day: i,
        monthOffset: 0,
        date: d,
        isToday: ceYear === todayCEYear && this.viewMonth === todayMonth && i === todayDate,
        isSelected: ceYear === selY && this.viewMonth === selM && i === selD
      });
    }

    // Next month days to fill 35 or 42 grid cells
    const remaining = (firstDay + daysInMonth) > 35 ? 42 - (firstDay + daysInMonth) : 35 - (firstDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(ceYear, this.viewMonth + 1, i);
      days.push({
        day: i,
        monthOffset: 1,
        date: d,
        isToday: d.getFullYear() === todayCEYear && d.getMonth() === todayMonth && d.getDate() === todayDate,
        isSelected: d.getFullYear() === selY && d.getMonth() === selM && d.getDate() === selD
      });
    }

    this.calendarDays = days;
  }

  // --- Day Selection ---
  selectDay(item: CalendarDay): void {
    if (this.disabled) return;
    const date = item.date;
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();

    const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const beYear = y + 543;
    this.displayText = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${beYear}`;
    this.innerValue = isoDate;

    this.viewMonth = date.getMonth();
    this.viewYearBE = beYear;
    this.generateCalendarDays();

    this.onChange(isoDate);
    this.onTouched();
    this.closeCalendar();
  }

  // --- Quick Actions ---
  selectToday(): void {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const beYear = y + 543;
    this.displayText = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${beYear}`;
    this.innerValue = isoDate;

    this.viewMonth = today.getMonth();
    this.viewYearBE = beYear;
    this.generateCalendarDays();

    this.onChange(isoDate);
    this.onTouched();
    this.closeCalendar();
  }

  clearDate(): void {
    this.displayText = '';
    this.innerValue = '';
    this.generateCalendarDays();
    this.onChange('');
    this.onTouched();
    this.closeCalendar();
  }

  // --- Manual Text Input Handling ---
  onManualInput(event: any): void {
    const text = (event.target.value || '').trim();
    if (!text) {
      this.clearDate();
      return;
    }

    // Match DD/MM/YYYY or D/M/YYYY
    const parts = text.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);

      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        let ceYear = y;
        let beYear = y;
        if (y >= 2400) {
          ceYear = y - 543;
        } else {
          beYear = y + 543;
        }

        const validDate = new Date(ceYear, m - 1, d);
        if (validDate.getFullYear() === ceYear && validDate.getMonth() === m - 1 && validDate.getDate() === d) {
          const isoDate = `${ceYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          this.innerValue = isoDate;
          this.displayText = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${beYear}`;
          this.viewMonth = m - 1;
          this.viewYearBE = beYear;
          this.generateCalendarDays();
          this.onChange(isoDate);
          return;
        }
      }
    }
  }

  onBlur(): void {
    this.onTouched();
    // ถ้าพิมพ์ค่าที่ไม่ถูกต้อง คืนค่าตาม innerValue เดิม
    if (this.innerValue) {
      const parts = this.innerValue.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const beYear = y < 2500 ? y + 543 : y;
        this.displayText = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${beYear}`;
      }
    } else {
      this.displayText = '';
    }
  }
}
