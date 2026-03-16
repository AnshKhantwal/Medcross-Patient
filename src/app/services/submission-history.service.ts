import { Injectable } from '@angular/core';
import { Task } from '../components/tasks/tasks';
import { VitalData } from '../components/vitals/vitals';

export interface VitalsSubmission {
  date: string;
  submittedAt: string;
  vitals: VitalData;
}

export interface TasksSubmission {
  date: string;
  submittedAt: string;
  tasks: Task[];
}

export interface HistoryRecord {
  date: string;
  vitals: VitalsSubmission | null;
  tasks: TasksSubmission | null;
}

@Injectable({
  providedIn: 'root'
})
export class SubmissionHistoryService {
  private readonly vitalsStorageKey = 'medcross.vitals.history';
  private readonly tasksStorageKey = 'medcross.tasks.history';

  saveVitals(date: Date, vitals: VitalData): void {
    const normalizedDate = this.normalizeDate(date);
    const vitalsHistory = this.readMap<VitalsSubmission>(this.vitalsStorageKey);

    vitalsHistory[normalizedDate] = {
      date: normalizedDate,
      submittedAt: new Date().toISOString(),
      vitals: this.clone(vitals)
    };

    this.writeMap(this.vitalsStorageKey, vitalsHistory);
  }

  saveTasks(date: Date, tasks: Task[]): void {
    const normalizedDate = this.normalizeDate(date);
    const tasksHistory = this.readMap<TasksSubmission>(this.tasksStorageKey);

    tasksHistory[normalizedDate] = {
      date: normalizedDate,
      submittedAt: new Date().toISOString(),
      tasks: this.clone(tasks)
    };

    this.writeMap(this.tasksStorageKey, tasksHistory);
  }

  getHistoryByDate(date: Date): HistoryRecord {
    const normalizedDate = this.normalizeDate(date);
    const vitalsHistory = this.readMap<VitalsSubmission>(this.vitalsStorageKey);
    const tasksHistory = this.readMap<TasksSubmission>(this.tasksStorageKey);

    return {
      date: normalizedDate,
      vitals: vitalsHistory[normalizedDate] ?? null,
      tasks: tasksHistory[normalizedDate] ?? null
    };
  }

  private normalizeDate(date: Date): string {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    const year = normalized.getFullYear();
    const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
    const day = `${normalized.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private readMap<T>(storageKey: string): Record<string, T> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as Record<string, T>;
    } catch {
      return {};
    }
  }

  private writeMap<T>(storageKey: string, value: Record<string, T>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}