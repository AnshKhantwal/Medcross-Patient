import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Patient {
  name: string;
}

interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
  patientName: string;
}

const TOKEN_KEY = 'medcross_token';
const PATIENT_KEY = 'medcross_patient';
const MUST_CHANGE_KEY = 'medcross_must_change_password';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentPatient = signal<Patient | null>(null);
  private avatar = signal<string | null>(null);
  private mustChangePassword = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    const savedPatient = localStorage.getItem(PATIENT_KEY);
    if (savedPatient && this.getToken()) {
      this.currentPatient.set(JSON.parse(savedPatient));
      this.mustChangePassword.set(localStorage.getItem(MUST_CHANGE_KEY) === 'true');
    }

    const savedAvatar = localStorage.getItem('medcross_avatar');
    if (savedAvatar) {
      this.avatar.set(savedAvatar);
    }
  }

  getAvatar() {
    return this.avatar;
  }

  setAvatar(dataUrl: string | null): void {
    this.avatar.set(dataUrl);
    if (dataUrl) {
      localStorage.setItem('medcross_avatar', dataUrl);
    } else {
      localStorage.removeItem('medcross_avatar');
    }
  }

  login(phoneNumber: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login`, { phoneNumber, password }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        localStorage.setItem(PATIENT_KEY, JSON.stringify({ name: res.patientName }));
        localStorage.setItem(MUST_CHANGE_KEY, String(res.mustChangePassword));
        this.currentPatient.set({ name: res.patientName });
        this.mustChangePassword.set(res.mustChangePassword);
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ accessToken: string }> {
    return this.http
      .post<{ accessToken: string }>(`${environment.apiBaseUrl}/api/auth/change-password`, {
        currentPassword,
        newPassword
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          localStorage.setItem(MUST_CHANGE_KEY, 'false');
          this.mustChangePassword.set(false);
        })
      );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    this.currentPatient.set(null);
    this.mustChangePassword.set(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PATIENT_KEY);
    localStorage.removeItem(MUST_CHANGE_KEY);
  }

  getPatient() {
    return this.currentPatient;
  }

  getMustChangePassword() {
    return this.mustChangePassword;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    return !this.isTokenExpired(token);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
