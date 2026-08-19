import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';
import { Task, TaskStatus } from '../components/tasks/tasks';
import { VitalData } from '../components/vitals/vitals';
import { environment } from '../../environments/environment';

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

export interface HistoryTimelineItem extends HistoryRecord {
  lastSubmittedAt: string;
}

interface ApiVitalsRecord {
  id: number;
  date: string;
  heightCm: number | null;
  weightKg: number | null;
  temperatureF: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  respiratoryRate: number | null;
  pulse: number | null;
  spo2: number | null;
}

interface ApiTaskCheckIn {
  taskKey: string;
  status: string;
}

interface ApiTasksHistoryEntry {
  date: string;
  tasks: ApiTaskCheckIn[];
  lastSubmittedAtUtc: string;
}

const TASK_META: Record<string, { name: string; category: string; icon: string }> = {
  medicine: { name: 'Medicine', category: 'Health', icon: 'pill' },
  diet: { name: 'Diet', category: 'Nutrition', icon: 'diet' },
  exercise: { name: 'Exercise', category: 'Wellness', icon: 'exercise' },
  chota_recharge: { name: 'Chota Recharge', category: 'Recharge', icon: 'water' },
  yoga_meditation: { name: 'Yoga Meditation', category: 'Wellness', icon: 'meditation' }
};

@Injectable({
  providedIn: 'root'
})
export class SubmissionHistoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  saveVitals(date: Date, vitals: VitalData): Observable<void> {
    const heightCm = this.feetInchesToCm(vitals.heightFeet, vitals.heightInches);

    const payload = {
      date: this.toIsoDate(date),
      heightCm,
      weightKg: vitals.weight,
      temperatureF: vitals.temperature,
      bpSystolic: vitals.bpSystolic,
      bpDiastolic: vitals.bpDiastolic,
      respiratoryRate: vitals.respiratoryRate,
      pulse: vitals.pulse,
      spo2: vitals.spo2
    };

    return this.http.post<void>(`${this.base}/vitals`, payload);
  }

  saveTasks(date: Date, tasks: Task[]): Observable<void> {
    const payload = {
      date: this.toIsoDate(date),
      tasks: tasks
        .filter((t) => t.status !== null)
        .map((t) => ({ taskKey: t.id, status: t.status }))
    };

    return this.http.post<void>(`${this.base}/tasks`, payload);
  }

  getHistoryByDate(date: Date): Observable<HistoryRecord> {
    const isoDate = this.toIsoDate(date);

    return forkJoin({
      vitals: this.http.get<ApiVitalsRecord[]>(`${this.base}/vitals`),
      tasks: this.http.get<{ date: string; tasks: ApiTaskCheckIn[] }>(`${this.base}/tasks`, {
        params: { date: isoDate }
      })
    }).pipe(
      map(({ vitals, tasks }) => {
        const vitalRecord = vitals.find((v) => this.toIsoDate(new Date(v.date)) === isoDate) ?? null;
        return {
          date: isoDate,
          vitals: vitalRecord ? this.toVitalsSubmission(vitalRecord) : null,
          tasks: tasks.tasks.length ? this.toTasksSubmission(isoDate, tasks.tasks, isoDate) : null
        };
      })
    );
  }

  getAllHistory(): Observable<HistoryTimelineItem[]> {
    return forkJoin({
      vitals: this.http.get<ApiVitalsRecord[]>(`${this.base}/vitals`),
      tasksHistory: this.http.get<ApiTasksHistoryEntry[]>(`${this.base}/tasks/history`)
    }).pipe(
      map(({ vitals, tasksHistory }) => {
        const vitalsByDate = new Map<string, VitalsSubmission>();
        for (const v of vitals) {
          const isoDate = this.toIsoDate(new Date(v.date));
          vitalsByDate.set(isoDate, this.toVitalsSubmission(v));
        }

        const tasksByDate = new Map<string, TasksSubmission>();
        for (const entry of tasksHistory) {
          const isoDate = this.toIsoDate(new Date(entry.date));
          tasksByDate.set(isoDate, this.toTasksSubmission(isoDate, entry.tasks, entry.lastSubmittedAtUtc));
        }

        const allDates = new Set<string>([...vitalsByDate.keys(), ...tasksByDate.keys()]);

        return Array.from(allDates)
          .map((date) => {
            const vitalsEntry = vitalsByDate.get(date) ?? null;
            const tasksEntry = tasksByDate.get(date) ?? null;
            const lastSubmittedAt = this.resolveLastSubmittedAt(
              vitalsEntry?.submittedAt,
              tasksEntry?.submittedAt
            );

            return { date, vitals: vitalsEntry, tasks: tasksEntry, lastSubmittedAt };
          })
          .sort((a, b) => new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime());
      })
    );
  }

  private toVitalsSubmission(v: ApiVitalsRecord): VitalsSubmission {
    const { feet, inches } = this.cmToFeetInches(v.heightCm);
    return {
      date: this.toIsoDate(new Date(v.date)),
      submittedAt: v.date,
      vitals: {
        heightFeet: feet,
        heightInches: inches,
        weight: v.weightKg,
        temperature: v.temperatureF,
        bpSystolic: v.bpSystolic,
        bpDiastolic: v.bpDiastolic,
        respiratoryRate: v.respiratoryRate,
        pulse: v.pulse,
        spo2: v.spo2
      }
    };
  }

  private toTasksSubmission(isoDate: string, apiTasks: ApiTaskCheckIn[], submittedAt: string): TasksSubmission {
    const tasks: Task[] = apiTasks.map((t) => ({
      id: t.taskKey,
      name: TASK_META[t.taskKey]?.name ?? t.taskKey,
      category: TASK_META[t.taskKey]?.category ?? 'Other',
      icon: TASK_META[t.taskKey]?.icon ?? 'pill',
      status: t.status as TaskStatus
    }));

    return { date: isoDate, submittedAt, tasks };
  }

  private resolveLastSubmittedAt(vitalsSubmittedAt?: string, tasksSubmittedAt?: string): string {
    if (!vitalsSubmittedAt && !tasksSubmittedAt) {
      return new Date(0).toISOString();
    }
    if (!vitalsSubmittedAt) {
      return tasksSubmittedAt!;
    }
    if (!tasksSubmittedAt) {
      return vitalsSubmittedAt;
    }
    return new Date(vitalsSubmittedAt).getTime() >= new Date(tasksSubmittedAt).getTime()
      ? vitalsSubmittedAt
      : tasksSubmittedAt;
  }

  private toIsoDate(date: Date): string {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    const year = normalized.getFullYear();
    const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
    const day = `${normalized.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private feetInchesToCm(feet: number | null, inches: number | null): number | null {
    if (feet === null && inches === null) {
      return null;
    }
    const totalInches = (feet ?? 0) * 12 + (inches ?? 0);
    return Math.round(totalInches * 2.54 * 100) / 100;
  }

  private cmToFeetInches(cm: number | null): { feet: number | null; inches: number | null } {
    if (cm === null) {
      return { feet: null, inches: null };
    }
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  }
}
