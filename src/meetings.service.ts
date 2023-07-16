import { Injectable } from '@angular/core';

import { createClient } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MeetingsService {
  private readonly supabase;

  constructor() {
    const SUPABASE_URL = 'https://zztjhdzmfpatmptlawun.supabase.co';
    const SUPABASE_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6dGpoZHptZnBhdG1wdGxhd3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyNjY5MTEsImV4cCI6MjAwNDg0MjkxMX0.Sgt7iE-szU6qGPKfZk6ArGmSsi9moTBMKZukBzmm7Q8';
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  async createMeeting(meeting: Meeting): Promise<Meeting> {
    const { data, error } = await this.supabase
      .from('meetings')
      .insert([meeting])
      .select();

    error && console.error('API error', error);

    return data;
  }

  getMeetingById(id: number): Promise<Meeting> {
    return this.supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single()
      .then((response: { data: Meeting }) => response.data);
  }

  async updateMeetingById(id: number, meeting: Meeting): Promise<Meeting> {
    const { data, error } = await this.supabase
      .from('meetings')
      .update(meeting)
      .eq('id', id)
      .select();

    error && console.error('API error', error);

    return data;
  }

  observeMeetingById(id: number): Observable<Meeting> {
    const meeting$ = new Observable<Meeting>((observer) => {
      this.supabase
        .channel(`${id}-update-channel`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'meetings',
            filter: `id=eq.${id}`,
          },
          (payload: any) => observer.next(payload.new)
        )
        .subscribe((x: any) => console.log('supabase subscribe says', x));
    });

    return meeting$;
  }

  async unsubscribeAll(): Promise<void> {
    await this.supabase.removeAllChannels();
  }
}

export interface Meeting {
  id?: number;
  hourlyRate: number;
  participantsCount: number;
  startedAt: string;
}
