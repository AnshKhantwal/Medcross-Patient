import { Component, EventEmitter, Output, signal, computed } from '@angular/core';

@Component({
  selector: 'app-calendar',
  imports: [],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class CalendarComponent {
  @Output() dateSelected = new EventEmitter<Date>();

  currentDate = signal(new Date());
  selectedDate = signal<Date | null>(null);

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  currentMonth = computed(() => {
    return this.currentDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  calendarDays = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      days.push({
        date: dayDate,
        isCurrentMonth: true,
        isToday: dayDate.toDateString() === today.toDateString()
      });
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    return days;
  });

  previousMonth(): void {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const date = this.currentDate();
    this.currentDate.set(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  }

  selectDate(day: { date: Date; isCurrentMonth: boolean }): void {
    if (!this.isFutureDate(day.date)) {
      this.selectedDate.set(day.date);
    }
  }

  confirmSelection(): void {
    if (this.selectedDate()) {
      this.dateSelected.emit(this.selectedDate()!);
    }
  }

  isSelected(day: { date: Date }): boolean {
    const selected = this.selectedDate();
    return selected !== null && day.date.toDateString() === selected.toDateString();
  }

  isFutureDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }
}
