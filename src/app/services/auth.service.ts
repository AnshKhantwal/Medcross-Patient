import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface Patient {
  number: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentPatient = signal<Patient | null>(null);
  private avatar = signal<string | null>(null);

  constructor(private router: Router) {
    // Check localStorage for existing session
    const saved = localStorage.getItem('medcross_patient');
    if (saved) {
      this.currentPatient.set(JSON.parse(saved));
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

  login(patientNumber: string, password: string): boolean {
    // Simple validation - password is 'm' or 'medcross'
    if ((password === 'm' || password === 'medcross') && patientNumber.trim() !== '') {
      const patient: Patient = {
        number: patientNumber,
        name: 'Patient ' + patientNumber
      };
      this.currentPatient.set(patient);
      localStorage.setItem('medcross_patient', JSON.stringify(patient));
      return true;
    }
    return false;
  }

  logout(): void {
    this.currentPatient.set(null);
    localStorage.removeItem('medcross_patient');
    this.router.navigate(['/login']);
  }

  getPatient() {
    return this.currentPatient;
  }

  isLoggedIn(): boolean {
    return this.currentPatient() !== null;
  }
}
