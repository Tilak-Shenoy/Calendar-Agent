export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  location?: string;
}

export class CalendarService {
  private gapi: any;

  constructor() {
    this.gapi = window.gapi;
  }

  async getEvents(timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin?.toISOString(),
        timeMax: timeMax?.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.result.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const response = await this.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      return response.result;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const response = await this.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event,
      });

      return response.result;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }

  async getFreeBusy(timeMin: Date, timeMax: Date): Promise<any> {
    try {
      const response = await this.gapi.client.calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: 'primary' }],
        },
      });

      return response.result;
    } catch (error) {
      console.error('Error fetching free/busy information:', error);
      throw error;
    }
  }

  calculateMeetingStats(events: CalendarEvent[]): {
    totalMeetings: number;
    totalHours: number;
    averageMeetingDuration: number;
    meetingsByDay: Record<string, number>;
  } {
    const meetingsByDay: Record<string, number> = {};
    let totalMinutes = 0;

    events.forEach(event => {
      if (event.start.dateTime && event.end.dateTime) {
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // minutes

        totalMinutes += duration;

        const dayKey = startDate.toISOString().split('T')[0];
        meetingsByDay[dayKey] = (meetingsByDay[dayKey] || 0) + 1;
      }
    });

    const totalMeetings = events.length;
    const totalHours = totalMinutes / 60;
    const averageMeetingDuration = totalMeetings > 0 ? totalMinutes / totalMeetings : 0;

    return {
      totalMeetings,
      totalHours,
      averageMeetingDuration,
      meetingsByDay,
    };
  }
}

declare global {
  interface Window {
    gapi: any;
  }
}
