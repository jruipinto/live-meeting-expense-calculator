import 'zone.js/dist/zone';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Meeting, MeetingsService } from './meetings.service';
import {
  BehaviorSubject,
  combineLatest,
  interval,
  map,
  shareReplay,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';

declare global {
  interface Date {
    /**
     * Custom method added to Date prototype to allow generation of
     * strings similar to ISO but without timezone conversion to UTC.
     * @example
     * new Date('2023/05/29 11:00').toLocaleIsoString();
     * // 2023-05-29T11:00
     */
    toLocaleIsoString: () => string;
  }

  /** https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js */
  class QRCode {
    constructor(...args: any);
  }
}

Date.prototype.toLocaleIsoString = function () {
  const ISO_DATE_REGEXP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  const correctDate = new Date(
    this.getTime() - this.getTimezoneOffset() * 60000
  );
  return correctDate.toISOString().match(ISO_DATE_REGEXP)![0];
};

const MEETING_DEFAULT: Meeting = {
  id: 0,
  hourlyRate: 25,
  participantsCount: 45,
  startedAt: '',
};

@Component({
  selector: 'my-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  @ViewChild('qr')
  qrEl: any;

  meetingSubject = new BehaviorSubject(MEETING_DEFAULT);
  meeting$ = this.meetingSubject.asObservable().pipe(
    tap(async (meeting) => {
      if (meeting.id) {
        await this.meetingsService.updateMeetingById(meeting.id!, meeting);
      }
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  startedAt$ = this.meeting$.pipe(
    map((meeting) =>
      meeting.startedAt ? new Date(meeting.startedAt).toLocaleIsoString() : '-'
    )
  );

  expenseResult$ = combineLatest([this.meeting$, interval(1000)]).pipe(
    map(([meeting]) => {
      const startMs = new Date(meeting.startedAt).valueOf();
      const endMs = new Date().valueOf();
      const diffMs = endMs - startMs;
      const diffHours = diffMs / 1000 / 60 / 60;

      return (
        meeting.hourlyRate * meeting.participantsCount * diffHours || 0
      ).toFixed(2);
    })
  );

  destroySubject = new Subject<boolean>();

  constructor(private meetingsService: MeetingsService) {}

  async ngOnInit(): Promise<void> {
    await this.getMeeting();
    this.observeMeeting();

    new QRCode(this.qrEl.nativeElement, location.href);
  }

  async ngOnDestroy(): Promise<void> {
    await this.meetingsService.unsubscribeAll();
    this.destroySubject.next(true);
    this.destroySubject.complete();
  }

  updateMeeting(meetingUpdate: Partial<Meeting>): void {
    const meeting = this.validateMeeting(meetingUpdate);

    if (!this.isDifferent(meeting, this.meetingSubject.value)) {
      console.log('isEqual, so will ignore');
      return;
    }

    this.meetingSubject.next(meeting);

    console.log('form update', this.meetingSubject.value);
  }

  now(): string {
    return new Date().toISOString();
  }

  toDateTimeLocalType(isoDate: string): string {
    return isoDate === '-' ? '' : new Date(isoDate).toLocaleIsoString();
  }

  private async getMeeting(): Promise<void> {
    const currentUrl = new URL(location.href);
    const id = Number(currentUrl.searchParams.get('id'));

    const meeting = await this.meetingsService.getMeetingById(id);

    if (!meeting) {
      return;
    }
    this.updateMeeting(meeting);
  }

  private observeMeeting(): void {
    if (!this.meetingSubject.value.id) {
      return;
    }

    this.destroySubject.next(false);
    this.meetingsService
      .observeMeetingById(this.meetingSubject.value.id!)
      .pipe(takeUntil(this.destroySubject))
      .subscribe((meeting: Meeting) => {
        console.log('channel broadcasted: ', meeting);
        this.updateMeeting(meeting);
      });
  }

  private isDifferent(prev: any, next: any): boolean {
    return Object.keys(prev).some((k) => prev[k] !== next[k]);
  }

  private validateMeeting(meeting: Partial<Meeting>): Meeting {
    return {
      id: Number(meeting.id ?? this.meetingSubject.value.id),
      startedAt: String(
        new Date(
          meeting.startedAt ?? this.meetingSubject.value.startedAt
        ).toISOString()
      ),
      hourlyRate: Number(
        meeting.hourlyRate ?? this.meetingSubject.value.hourlyRate
      ),
      participantsCount: Number(
        meeting.participantsCount ?? this.meetingSubject.value.participantsCount
      ),
    };
  }
}

bootstrapApplication(App);
