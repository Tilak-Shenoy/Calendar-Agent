import { CalendarEvent } from './calendarService';
import { OpenAIService, CalendarStats } from './openaiService';

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export class CalendarAgent {
  private events: CalendarEvent[];
  private openaiService: OpenAIService;

  constructor(events: CalendarEvent[]) {
    this.events = events;
    this.openaiService = new OpenAIService();
  }

  async processMessage(message: string): Promise<string> {
    try {
      const stats = this.calculateMeetingStats();
      const response = await this.openaiService.processCalendarQuery(message, this.events, stats);
      return response;
    } catch (error) {
      console.error('CalendarAgent error:', error);
      return "I'm having trouble processing your request right now. Please try again later.";
    }
  }

  private calculateMeetingStats(): CalendarStats {
    const meetingsByDay: Record<string, number> = {};
    let totalMinutes = 0;

    this.events.forEach(event => {
      if (event.start.dateTime && event.end.dateTime) {
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // minutes

        totalMinutes += duration;

        const dayKey = startDate.toISOString().split('T')[0];
        meetingsByDay[dayKey] = (meetingsByDay[dayKey] || 0) + 1;
      }
    });

    const totalMeetings = this.events.length;
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
