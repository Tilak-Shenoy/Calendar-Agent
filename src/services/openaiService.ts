import OpenAI from 'openai';
import { CalendarEvent } from './calendarService';

export interface CalendarStats {
  totalMeetings: number;
  totalHours: number;
  averageMeetingDuration: number;
  meetingsByDay: Record<string, number>;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
    });
  }

  // Helper method to get current local time consistently
  private getLocalNow(): Date {
    return new Date();
  }

  // Helper method to create local date without time component
  private getLocalToday(): Date {
    const now = this.getLocalNow();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Helper method to convert Google Calendar event time to local Date
  private getLocalEventTime(eventTime: any): Date {
    if (eventTime.dateTime) {
      return new Date(eventTime.dateTime);
    } else if (eventTime.date) {
      // All-day events - treat as local date
      return new Date(eventTime.date);
    }
    return new Date();
  }

  async processCalendarQuery(
    message: string,
    events: CalendarEvent[],
    stats: CalendarStats
  ): Promise<string> {
    const systemPrompt = this.createSystemPrompt(events, stats);

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_completion_tokens: 1000,
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email_drafts",
              description: "Generate professional email drafts for scheduling meetings",
              parameters: {
                type: "object",
                properties: {
                  recipients: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of recipient names"
                  },
                  preferences: {
                    type: "object",
                    properties: {
                      avoidMornings: { type: "boolean" },
                      avoidAfternoons: { type: "boolean" },
                      specificTimes: { type: "string" }
                    }
                  }
                },
                required: ["recipients"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "analyze_meeting_time",
              description: "Analyze how much time is spent in meetings and provide insights",
              parameters: {
                type: "object",
                properties: {
                  timeframe: {
                    type: "string",
                    enum: ["week", "month", "all"],
                    description: "Timeframe for analysis"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "provide_recommendations",
              description: "Provide recommendations to reduce meeting time or improve schedule",
              parameters: {
                type: "object",
                properties: {
                  focusArea: {
                    type: "string",
                    enum: ["reduce_meetings", "optimize_schedule", "work_life_balance"],
                    description: "Area to focus recommendations on"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "find_conflicts",
              description: "Find overlapping/conflicting events in the calendar for a specified time period",
              parameters: {
                type: "object",
                properties: {
                  timeframe: {
                    type: "string",
                    description: "Time period to check for conflicts (e.g., 'today', 'tomorrow', 'week', 'month', 'this week', 'next week')"
                  }
                },
                required: ["timeframe"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "find_available_time_slots",
              description: "Find available time slots for meetings, avoiding conflicts with existing events",
              parameters: {
                type: "object",
                properties: {
                  duration: {
                    type: "string",
                    description: "Duration of the meeting (e.g., '30 minutes', '1 hour', '2 hours')"
                  },
                  preferredDate: {
                    type: "string",
                    description: "Preferred date for the meeting (e.g., 'today', 'tomorrow', '2024-01-15')"
                  },
                  preferredTimeRange: {
                    type: "string",
                    description: "Preferred time range (e.g., 'morning', 'afternoon', '9am-5pm')"
                  },
                  attendees: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of attendee emails (optional)"
                  }
                },
                required: ["duration"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_calendar_event",
              description: "Create a new calendar event or task",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Event title or task description"
                  },
                  description: {
                    type: "string",
                    description: "Detailed description of the event or task"
                  },
                  startTime: {
                    type: "string",
                    description: "Start time in ISO format or natural language (e.g., 'tomorrow at 2pm')"
                  },
                  endTime: {
                    type: "string",
                    description: "End time in ISO format or natural language"
                  },
                  attendees: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of attendee emails"
                  },
                  location: {
                    type: "string",
                    description: "Location of the event"
                  },
                  reminder: {
                    type: "object",
                    properties: {
                      minutes: { type: "number" },
                      method: { type: "string", enum: ["email", "popup"] }
                    }
                  }
                },
                required: ["summary", "startTime"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_calendar_event",
              description: "Update an existing calendar event",
              parameters: {
                type: "object",
                properties: {
                  eventTitle: {
                    type: "string",
                    description: "Title or description of the event to update (can be partial match)"
                  },
                  eventId: {
                    type: "string",
                    description: "ID of the event to update (optional, use if you know it)"
                  },
                  summary: {
                    type: "string",
                    description: "Updated event title"
                  },
                  description: {
                    type: "string",
                    description: "Updated description"
                  },
                  startTime: {
                    type: "string",
                    description: "Updated start time"
                  },
                  endTime: {
                    type: "string",
                    description: "Updated end time"
                  },
                  attendees: {
                    type: "array",
                    items: { type: "string" },
                    description: "Updated list of attendee emails"
                  },
                  location: {
                    type: "string",
                    description: "Updated location"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "delete_calendar_event",
              description: "Delete a calendar event",
              parameters: {
                type: "object",
                properties: {
                  eventTitle: {
                    type: "string",
                    description: "Title or description of the event to delete (can be partial match)"
                  },
                  eventId: {
                    type: "string",
                    description: "ID of the event to delete (optional, use if you know it)"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "list_upcoming_events",
              description: "List upcoming calendar events",
              parameters: {
                type: "object",
                properties: {
                  timeframe: {
                    type: "string",
                    enum: ["today", "tomorrow", "week", "month"],
                    description: "Timeframe to list events for"
                  },
                  filter: {
                    type: "string",
                    description: "Filter events by keyword or type"
                  }
                }
              }
            }
          }
        ],
        tool_choice: "auto"
      });

      const choice = completion.choices[0];

      const messageContent = choice.message;

      if (messageContent?.tool_calls && messageContent.tool_calls.length > 0) {
        const toolCall = messageContent.tool_calls[0];
        if ('function' in toolCall) {
          return await this.handleFunctionCall(toolCall.function, events, stats);
        }
      }

      return messageContent?.content || "I'm sorry, I couldn't process that request.";
    } catch (error) {
      console.error('OpenAI API error:', error);
      return "I'm having trouble connecting to my AI services. Please try again later.";
    }
  }

  private async handleFunctionCall(
    functionCall: any,
    events: CalendarEvent[],
    stats: CalendarStats
  ): Promise<string> {

    const { name, arguments: args } = functionCall;

    // Parse arguments if they're a string
    let parsedArgs;
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (error) {
        console.error('Error parsing function arguments:', error);
        parsedArgs = {};
      }
    } else {
      parsedArgs = args || {};
    }

    switch (name) {
      case 'generate_email_drafts':
        return this.generateEmailDrafts(parsedArgs.recipients, parsedArgs.preferences);

      case 'analyze_meeting_time':
        return this.analyzeMeetingTime(stats, parsedArgs.timeframe);

      case 'provide_recommendations':
        return await this.provideRecommendations(stats, parsedArgs.focusArea);

      case 'find_conflicts':
        return this.findConflicts(parsedArgs.timeframe, events);

      case 'find_available_time_slots':
        return this.findAvailableTimeSlots(parsedArgs, events);

      case 'create_calendar_event':
        return this.createCalendarEvent(parsedArgs);

      case 'update_calendar_event':
        return this.updateCalendarEvent(parsedArgs, events);

      case 'delete_calendar_event':
        return this.deleteCalendarEvent(parsedArgs, events);

      case 'list_upcoming_events':
        return this.listUpcomingEvents(events, parsedArgs.timeframe, parsedArgs.filter);

      default:
        return "I don't know how to handle that request.";
    }
  }

  private createSystemPrompt(events: CalendarEvent[], stats: CalendarStats): string {
    const eventsSummary = events.slice(0, 10).map(event => ({
      summary: event.summary,
      start: event.start.dateTime || event.start.date,
      duration: event.start.dateTime && event.end.dateTime
        ? Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / (1000 * 60))
        : null
    }));

    return `You are an intelligent calendar assistant helping users analyze their schedule and optimize their time. 

Current calendar data:
- Total meetings: ${stats.totalMeetings}
- Total hours in meetings: ${stats.totalHours.toFixed(1)}
- Average meeting duration: ${stats.averageMeetingDuration.toFixed(0)} minutes
- Recent events: ${JSON.stringify(eventsSummary, null, 2)}

Your capabilities:
1. Analyze meeting patterns and time usage
2. Provide actionable recommendations to reduce meeting time
3. Generate professional email drafts for scheduling
4. Help users optimize their work-life balance
5. Create new calendar events and tasks
6. Update existing calendar events
7. Delete calendar events
8. List and filter upcoming events
9. Set reminders for events

Guidelines:
- Be conversational and helpful
- Provide specific, actionable advice
- Consider work-life balance in recommendations
- Generate professional, courteous email drafts
- Use emojis appropriately for better user experience
- When creating events, parse natural language times (e.g., "tomorrow at 2pm")
- Always show event IDs for reference when updating/deleting
- Confirm important actions like deletions

When users ask about scheduling with specific people, use the generate_email_drafts function.
When users ask about meeting time analysis, use the analyze_meeting_time function.
When users ask for recommendations, use the provide_recommendations function.
When users want to create events, use the create_calendar_event function with proper arguments.
When users want to find conflicts, use the find_conflicts function to identify overlapping events.
When users want to find available time slots, use the find_available_time_slots function to avoid conflicts.
When users want to update events, use the update_calendar_event function with eventTitle or eventId.
When users want to delete events, use the delete_calendar_event function with eventTitle or eventId.
When users want to see events, use the list_upcoming_events function.

IMPORTANT: Always provide all required parameters for function calls. For create_calendar_event, always include 'summary' and 'startTime'. For update/delete operations, use 'eventTitle' for smart event resolution - the system will find events by title, partial match, or time automatically. Users don't need to remember event IDs. For finding time slots, always include 'duration' and optionally 'preferredDate' and 'preferredTimeRange'.`
  }

  private generateEmailDrafts(recipients: string[], preferences?: any): string {
    let response = `📧 ** Email Drafts Generated **\n\n`;

    recipients.forEach((person, index) => {
      const subject = preferences?.avoidMornings
        ? `Meeting Schedule - Protecting Morning Workout Time`
        : `Meeting Schedule Coordination`;

      let body = `Hi ${person}, \n\n`;

      if (preferences?.avoidMornings) {
        body += `I'm looking to schedule some time to connect with you, but I want to protect my morning workout routine for better work-life balance and productivity.\n\n`;

        // Get available time slots for the user
        const availableSlots = this.getAvailableTimeSlotsForEmail(preferences);

        if (availableSlots.length > 0) {
          body += `Would you be available for a meeting any of these times?\n`;
          availableSlots.forEach((slot: { start: Date; end: Date }) => {
            const timeStr = slot.start.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            const dateStr = slot.start.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            });
            body += `• ${dateStr} at ${timeStr}\n`;
          });
          body += `\n`;
        } else {
          body += `I'm currently quite booked, but I'd love to find a time that works for both of us.\n\n`;
        }

        body += `Or feel free to suggest a time that works better for you!\n\n`;
      } else {
        body += `I'd like to schedule some time to connect with you. I'm looking for availability in the coming weeks.\n\n`;

        // Get general available time slots
        const availableSlots = this.getAvailableTimeSlotsForEmail(preferences);

        if (availableSlots.length > 0) {
          body += `Here are some times that work well for me:\n`;
          availableSlots.slice(0, 5).forEach((slot: { start: Date; end: Date }) => { // Show top 5 slots
            const timeStr = slot.start.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            const dateStr = slot.start.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            });
            body += `• ${dateStr} at ${timeStr}\n`;
          });
          body += `\n`;
        }

        body += `Please let me know what days and times work best for your schedule, and I'll do my best to accommodate.\n\n`;
      }

      body += `Looking forward to connecting!\n\n`;
      body += `Best regards,\n`;
      body += `[Your Name]`;

      response += `**Email ${index + 1} - To: ${person}**\n`;
      response += `Subject: ${subject}\n\n`;
      response += `${body}\n\n`;
      response += `---\n\n`;
    });

    response += `💡 **Tip**: Feel free to customize these drafts with specific dates or additional context!`;

    return response;
  }

  private analyzeMeetingTime(stats: CalendarStats, timeframe: string = 'month'): string {
    const weeklyHours = stats.totalHours;
    const dailyAverage = weeklyHours / 7;
    const percentageOfDay = (dailyAverage / 8) * 100;

    let response = `📊 **Your Meeting Analysis**\n\n`;
    response += `• **Total meetings**: ${stats.totalMeetings}\n`;
    response += `• **Total meeting time**: ${weeklyHours.toFixed(1)} hours\n`;
    response += `• **Daily average**: ${dailyAverage.toFixed(1)} hours (${percentageOfDay.toFixed(0)}% of an 8-hour day)\n`;
    response += `• **Average meeting duration**: ${stats.averageMeetingDuration.toFixed(0)} minutes\n\n`;

    if (percentageOfDay > 60) {
      response += `⚠️ **You're spending a lot of time in meetings!** Consider implementing some of these strategies to reclaim your time.\n\n`;
    } else if (percentageOfDay > 40) {
      response += `📈 **Your meeting load is moderate.** There's room for optimization to increase focused work time.\n\n`;
    } else {
      response += `✅ **Your meeting load seems reasonable.** You have good balance between meetings and focused work.\n\n`;
    }

    return response;
  }

  private async provideRecommendations(stats: CalendarStats, focusArea: string): Promise<string> {
    try {
      // Create a detailed prompt with the user's actual calendar data
      const analysisPrompt = `You are a calendar productivity expert. Analyze the user's calendar statistics and provide personalized recommendations.

Calendar Statistics:
- Total meetings: ${stats.totalMeetings}
- Total meeting hours: ${stats.totalHours.toFixed(1)}
- Average meeting duration: ${stats.averageMeetingDuration.toFixed(0)} minutes
- Meetings by day: ${JSON.stringify(stats.meetingsByDay)}

Focus area: ${focusArea}

Please provide:
1. A brief analysis of their current calendar patterns
2. 3-4 specific, actionable recommendations based on their actual data
3. Consider their meeting frequency, duration patterns, and daily distribution
4. Make recommendations practical and personalized to their situation

Format your response with clear headings and bullet points. Be encouraging and constructive.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a calendar productivity expert who provides personalized, data-driven recommendations. Be practical, encouraging, and specific."
          },
          { role: "user", content: analysisPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const aiResponse = completion.choices[0].message.content;

      // Format the response with our standard emoji styling
      let response = `💡 **Personalized Calendar Recommendations**\n\n`;
      response += `📊 **Based on your actual calendar data:**\n\n`;
      response += aiResponse || "I couldn't generate personalized recommendations at the moment. Please try again.";

      return response;
    } catch (error) {
      console.error('Error generating recommendations:', error);

      // Fallback to basic recommendations if AI fails
      let response = `💡 **Calendar Recommendations**\n\n`;
      response += `📊 **Based on your calendar patterns:**\n\n`;
      response += `1. **Review your meeting frequency** - You have ${stats.totalMeetings} meetings totaling ${stats.totalHours.toFixed(1)} hours\n`;

      if (stats.averageMeetingDuration > 45) {
        response += `2. **Consider shorter meetings** - Your average is ${stats.averageMeetingDuration.toFixed(0)} minutes. Many meetings could be 30 minutes or less\n`;
      }

      response += `3. **Batch similar meetings** - Group related meetings together for better focus\n`;
      response += `4. **Add buffer time** - Schedule 15-minute breaks between meetings\n`;

      return response;
    }
  }

  private async createCalendarEvent(args: any): Promise<string> {
    // Validate required fields and ask for missing information
    const validation = this.validateEventCreation(args);
    if (!validation.isValid) {
      return validation.message;
    }

    try {
      const eventData: any = {
        summary: args.summary,
        description: args.description || '',
        start: {
          dateTime: this.parseDateTime(args.startTime).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: this.parseDateTime(args.endTime || (() => {
            const start = this.parseDateTime(args.startTime);
            const durationMinutes = args.duration ? this.parseDurationToMinutes(args.duration) : 60;
            return new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString();
          })()).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      if (args.attendees) {
        eventData.attendees = args.attendees.map((email: string) => ({ email }));
      }
      if (args.location) eventData.location = args.location;

      // Add reminders if specified
      if (args.reminder) {
        eventData.reminders = {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: args.reminder },
            { method: 'popup', minutes: args.reminder }
          ]
        };
      }

      const response = await window.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: eventData
      });

      const createdEvent = response.result;

      let responseText = `✅ **Event Created Successfully!**\n\n`;
      responseText += `📅 **${createdEvent.summary}**\n`;
      responseText += `🕐 ${new Date(createdEvent.start.dateTime).toLocaleString()}\n`;
      responseText += `🕕 ${new Date(createdEvent.end.dateTime).toLocaleString()}\n`;

      if (createdEvent.location) {
        responseText += `📍 ${createdEvent.location}\n`;
      }

      responseText += `\nEvent ID: ${createdEvent.id}`;
      responseText += `\n\n💡 You can reference this event by its title or time when updating or deleting it.`;

      return responseText;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return "❌ I couldn't create the event. Please check your calendar permissions and try again.";
    }
  }

  private validateEventCreation(args: any): { isValid: boolean; message: string } {
    const missing: string[] = [];

    // Check required fields
    if (!args.summary) {
      missing.push("event title (what's the event called?)");
    }

    if (!args.startTime) {
      missing.push("start time (when should the event begin?)");
    }

    // Check if we have either end time or duration
    if (!args.endTime && !args.duration) {
      missing.push("end time or duration (how long should it last?)");
    }

    // Check if this seems like a meeting with others but no attendees provided
    if (args.summary && this.seemsLikeMeeting(args.summary) && !args.attendees) {
      missing.push("attendee emails (who should be invited to this meeting?)");
    }

    // Validate attendee emails if provided
    if (args.attendees && Array.isArray(args.attendees)) {
      const invalidEmails = args.attendees.filter((email: string) => !this.isValidEmail(email));
      if (invalidEmails.length > 0) {
        missing.push(`valid email addresses for attendees (invalid: ${invalidEmails.join(', ')})`);
      }
    }

    // If there are missing fields, ask for them
    if (missing.length > 0) {
      let message = `❓ **I need a few more details to create your event:**\n\n`;
      missing.forEach((field, index) => {
        message += `${index + 1}. ${field}\n`;
      });

      if (missing.some(field => field.includes("email"))) {
        message += `\n💡 **Example with valid emails:** "Create a team meeting tomorrow at 2pm for 1 hour with john@example.com, sarah@company.com"`;
        message += `\n💡 **Note:** Please provide full email addresses (e.g., john.doe@company.com)`;
      } else {
        message += `\n💡 **Example:** "Create a team meeting tomorrow at 2pm for 1 hour"`;
        message += `\n💡 **Or:** "Schedule a call with John today at 3pm until 4pm"`;
      }

      return { isValid: false, message };
    }

    return { isValid: true, message: "" };
  }

  private seemsLikeMeeting(summary: string): boolean {
    const meetingKeywords = [
      'meeting', 'meet', 'call', 'conference', 'discussion', 'review', 'standup',
      'sync', 'check-in', 'checkin', 'interview', 'presentation', 'demo',
      'workshop', 'training', 'brainstorm', 'planning', 'retrospective',
      '1:1', 'one-on-one', 'team', 'client', 'customer', 'stakeholder'
    ];

    const lowerSummary = summary.toLowerCase();
    return meetingKeywords.some(keyword => lowerSummary.includes(keyword));
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validateEventUpdate(args: any): { isValid: boolean; message: string } {
    const missing: string[] = [];

    // Need to identify which event to update
    if (!args.eventId && !args.eventTitle && !args.summary) {
      missing.push("event identification (which event do you want to update?)");
    }

    // Need at least one field to update
    const hasUpdateFields = args.summary || args.description || args.startTime || args.endTime ||
      args.attendees || args.location || args.duration;

    if (!hasUpdateFields) {
      missing.push("update details (what do you want to change?)");
    }

    // If there are missing fields, ask for them
    if (missing.length > 0) {
      let message = `❓ **I need more information to update your event:**\n\n`;
      missing.forEach((field, index) => {
        message += `${index + 1}. ${field}\n`;
      });

      message += `\n💡 **Example:** "Update the team meeting to 3pm"`;
      message += `\n💡 **Or:** "Move my call with John to tomorrow at 2pm"`;
      message += `\n💡 **Or:** "Change the team standup location to Conference Room B"`;

      return { isValid: false, message };
    }

    return { isValid: true, message: "" };
  }

  private findAvailableTimeSlots(args: any, events: CalendarEvent[]): string {
    const duration = args.duration || '1 hour';
    const preferredDate = args.preferredDate || 'today';
    const preferredTimeRange = args.preferredTimeRange || '9am-5pm';

    // Parse duration to minutes
    const durationMinutes = this.parseDurationToMinutes(duration);

    // Get the target date
    const targetDate = this.getTargetDate(preferredDate);

    // Get time range bounds
    const { startTime, endTime } = this.parseTimeRange(preferredTimeRange, targetDate);

    // Filter events for the target date
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '');
      return eventDate.toDateString() === targetDate.toDateString();
    });

    // Find available slots
    const availableSlots = this.findFreeSlots(dayEvents, startTime, endTime, durationMinutes);

    if (availableSlots.length === 0) {
      return `😔 **No available time slots found**\n\n` +
        `I couldn't find any ${duration} slots on ${targetDate.toLocaleDateString()} ` +
        `between ${preferredTimeRange}.\n\n` +
        `💡 **Suggestions:**\n` +
        `- Try a different date\n` +
        `- Try a shorter duration\n` +
        `- Try a different time range (like evening)`;
    }

    let response = `🕐 **Available Time Slots**\n\n`;
    response += `📅 **Date:** ${targetDate.toLocaleDateString()}\n`;
    response += `⏱️ **Duration:** ${duration}\n`;
    response += `🕒 **Time Range:** ${preferredTimeRange}\n\n`;

    availableSlots.forEach((slot, index) => {
      const startTimeStr = slot.start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const endTimeStr = slot.end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      response += `${index + 1}. **${startTimeStr} - ${endTimeStr}**\n`;

      // Check if there are events immediately before/after
      const beforeEvent = this.findEventBeforeTime(dayEvents, slot.start);
      const afterEvent = this.findEventAfterTime(dayEvents, slot.end);

      if (beforeEvent) {
        response += `   ⬅️ After: ${beforeEvent.summary}\n`;
      }
      if (afterEvent) {
        response += `   ➡️ Before: ${afterEvent.summary}\n`;
      }

      response += '\n';
    });

    response += `💡 **To schedule:** "Create a meeting [title] tomorrow at ${availableSlots[0].start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}"`;

    return response;
  }

  private getAvailableTimeSlotsForEmail(preferences?: any): Array<{ start: Date; end: Date }> {
    // This is a simplified version for email generation
    // In a real implementation, this would use the actual events data
    // For now, we'll generate some sample time slots based on preferences

    const now = this.getLocalNow();
    const slots: Array<{ start: Date; end: Date }> = [];

    // Generate slots for the next 7 days
    for (let i = 1; i <= 7; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);

      // Skip weekends for business meetings unless specified
      if (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
        if (!preferences?.includeWeekends) continue;
      }

      // Generate time slots based on preferences
      if (preferences?.avoidMornings) {
        // Avoid mornings (before 11 AM)
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 11, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 11, 30)
        });
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 14, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 14, 30)
        });
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 16, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 16, 30)
        });
      } else {
        // Include morning slots
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 9, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 9, 30)
        });
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 11, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 11, 30)
        });
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 14, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 14, 30)
        });
        slots.push({
          start: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 16, 0),
          end: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 16, 30)
        });
      }
    }

    // Sort by date and time
    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private parseDurationToMinutes(duration: string): number {
    const match = duration.match(/(\d+)\s*(minutes?|hours?|mins?|hrs?|h|m)/i);
    if (!match) return 60; // Default to 1 hour

    const [, amount, unit] = match;
    const value = parseInt(amount);

    if (unit.toLowerCase().startsWith('h')) {
      return value * 60;
    } else {
      return value;
    }
  }

  private parseTimeRange(timeRange: string, date: Date): { startTime: Date; endTime: Date } {
    // Default to 9am-5pm
    let startHour = 9;
    let endHour = 17;

    // Parse custom time range like "9am-5pm", "10:00-16:00", etc.
    const rangeMatch = timeRange.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (rangeMatch) {
      const [, startHours, startMinutes, startPeriod, endHours, endMinutes, endPeriod] = rangeMatch;

      startHour = parseInt(startHours);
      const startMinute = startMinutes ? parseInt(startMinutes) : 0;
      if (startPeriod?.toLowerCase() === 'pm' && startHour !== 12) startHour += 12;
      if (startPeriod?.toLowerCase() === 'am' && startHour === 12) startHour = 0;

      endHour = parseInt(endHours);
      const endMinute = endMinutes ? parseInt(endMinutes) : 0;
      if (endPeriod?.toLowerCase() === 'pm' && endHour !== 12) endHour += 12;
      if (endPeriod?.toLowerCase() === 'am' && endHour === 12) endHour = 0;

      const startTime = new Date(date);
      startTime.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(endHour, endMinute, 0, 0);

      return { startTime, endTime };
    }

    // Handle predefined ranges like "morning", "afternoon", "evening"
    switch (timeRange.toLowerCase()) {
      case 'morning':
        startHour = 8;
        endHour = 12;
        break;
      case 'afternoon':
        startHour = 12;
        endHour = 17;
        break;
      case 'evening':
        startHour = 17;
        endHour = 21;
        break;
    }

    const startTime = new Date(date);
    startTime.setHours(startHour, 0, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, 0, 0, 0);

    return { startTime, endTime };
  }

  private findFreeSlots(events: CalendarEvent[], dayStart: Date, dayEnd: Date, durationMinutes: number): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];

    // Sort events by start time
    const sortedEvents = events
      .filter(event => event.start.dateTime) // Only consider events with specific times
      .map(event => ({
        start: new Date(event.start.dateTime!),
        end: new Date(event.end.dateTime!)
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = new Date(dayStart);

    for (const event of sortedEvents) {
      // Check if there's a gap before this event
      const gapMinutes = (event.start.getTime() - currentTime.getTime()) / (1000 * 60);

      if (gapMinutes >= durationMinutes) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + durationMinutes * 60 * 1000)
        });
      }

      // Move current time past this event
      currentTime = new Date(Math.max(currentTime.getTime(), event.end.getTime()));
    }

    // Check if there's time after the last event
    const remainingMinutes = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);
    if (remainingMinutes >= durationMinutes) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(currentTime.getTime() + durationMinutes * 60 * 1000)
      });
    }

    return slots;
  }

  private findEventBeforeTime(events: CalendarEvent[], time: Date): CalendarEvent | null {
    const beforeEvents = events
      .filter(event => event.start.dateTime)
      .filter(event => new Date(event.start.dateTime!) < time)
      .sort((a, b) => new Date(b.start.dateTime!).getTime() - new Date(a.start.dateTime!).getTime());

    return beforeEvents.length > 0 ? beforeEvents[0] : null;
  }

  private findEventAfterTime(events: CalendarEvent[], time: Date): CalendarEvent | null {
    const afterEvents = events
      .filter(event => event.start.dateTime)
      .filter(event => new Date(event.start.dateTime!) > time)
      .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime());

    return afterEvents.length > 0 ? afterEvents[0] : null;
  }

  private findConflicts(timeframe: string, events: CalendarEvent[]): string {
    // Filter events for the specified timeframe using local time
    const now = this.getLocalNow();
    const today = this.getLocalToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let timeframeEvents = [...events];

    switch (timeframe.toLowerCase()) {
      case 'today':
        timeframeEvents = events.filter(event => {
          const eventDate = this.getLocalEventTime(event.start);
          const isToday = eventDate.toDateString() === today.toDateString();
          return isToday;
        });
        break;
      case 'tomorrow':
        timeframeEvents = events.filter(event => {
          const eventDate = this.getLocalEventTime(event.start);
          const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
          return isTomorrow;
        });
        break;
      case 'week':
      case 'this week':
        timeframeEvents = events.filter(event => {
          const eventDate = this.getLocalEventTime(event.start);
          return eventDate >= today && eventDate <= weekEnd;
        });
        break;
      case 'month':
        timeframeEvents = events.filter(event => {
          const eventDate = this.getLocalEventTime(event.start);
          return eventDate >= today && eventDate <= monthEnd;
        });
        break;
    }

    // Sort events by start time for conflict detection
    const sortedEvents = timeframeEvents
      .filter((event: CalendarEvent) => event.start.dateTime) // Only consider events with specific times
      .map((event: CalendarEvent) => ({
        ...event,
        start: this.getLocalEventTime(event.start),
        end: this.getLocalEventTime(event.end)
      }))
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());

    const conflicts: Array<{
      event1: any;
      event2: any;
      overlapDuration: number;
      conflictType: string;
    }> = [];

    // Find overlapping events
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        const event1 = sortedEvents[i];
        const event2 = sortedEvents[j];

        // Check if events overlap
        const overlapStart = new Date(Math.max(event1.start.getTime(), event2.start.getTime()));
        const overlapEnd = new Date(Math.min(event1.end.getTime(), event2.end.getTime()));

        if (overlapStart < overlapEnd) {
          const overlapDuration = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60); // in minutes

          conflicts.push({
            event1,
            event2,
            overlapDuration,
            conflictType: this.getConflictType(overlapDuration)
          });
        }
      }
    }

    if (conflicts.length === 0) {
      return `✅ **No Conflicts Found**\n\n` +
        `📅 **Time Period:** ${timeframe}\n` +
        `🎉 Great! Your calendar has no overlapping events during this period.\n\n` +
        `💡 **Tip:** Use "find available time slots" to see open time periods for scheduling.`;
    }

    // Format conflicts for display
    let response = `⚠️ **Calendar Conflicts Detected**\n\n`;
    response += `📅 **Time Period:** ${timeframe}\n`;
    response += `🔴 **Found ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}:**\n\n`;

    conflicts.forEach((conflict, index) => {
      response += `${index + 1}. **${conflict.conflictType}**\n\n`;

      response += `   📋 **Event 1:** ${conflict.event1.summary}\n`;
      response += `      🕐 ${conflict.event1.start.toLocaleString()} - ${conflict.event1.end.toLocaleString()}\n`;
      if (conflict.event1.location) response += `      📍 ${conflict.event1.location}\n`;

      response += `   📋 **Event 2:** ${conflict.event2.summary}\n`;
      response += `      🕐 ${conflict.event2.start.toLocaleString()} - ${conflict.event2.end.toLocaleString()}\n`;
      if (conflict.event2.location) response += `      📍 ${conflict.event2.location}\n`;

      response += `      ⚠️ **Overlap:** ${Math.round(conflict.overlapDuration)} minutes\n\n`;
    });

    response += `💡 **Suggestions:**\n`;
    response += `- Use "find available time slots" to see open periods\n`;
    response += `- Consider rescheduling one of the conflicting events\n`;
    response += `- Check if either event can be shortened or moved\n`;

    return response;
  }

  private getConflictType(overlapDuration: number): string {
    if (overlapDuration >= 60) return "Major Conflict (1+ hour overlap)";
    if (overlapDuration >= 30) return "Significant Conflict (30+ minutes)";
    if (overlapDuration >= 15) return "Moderate Conflict (15+ minutes)";
    return "Minor Conflict (< 15 minutes)";
  }

  private async updateCalendarEvent(args: any, events: CalendarEvent[]): Promise<string> {
    // Validate required fields and ask for missing information
    const validation = this.validateEventUpdate(args);
    if (!validation.isValid) {
      return validation.message;
    }

    // Find the event using smart resolution
    const eventResolution = this.resolveEvent(args.eventId || args.eventTitle || args.summary, events);

    if (eventResolution.type === 'not_found') {
      return eventResolution.message;
    }

    if (eventResolution.type === 'multiple_found') {
      return eventResolution.message;
    }

    // Single event found, proceed with update
    const eventId = eventResolution.eventId;
    try {
      // First, get the existing event to preserve its duration
      const existingEventResponse = await window.gapi.client.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });
      const existingEvent = existingEventResponse.result;

      // Calculate existing duration in minutes
      let existingDurationMinutes = 60; // Default to 1 hour
      if (existingEvent.start.dateTime && existingEvent.end.dateTime) {
        const startTime = new Date(existingEvent.start.dateTime);
        const endTime = new Date(existingEvent.end.dateTime);
        existingDurationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      }

      const eventData: any = {};

      // Always include existing fields to preserve them
      eventData.summary = args.summary || existingEvent.summary;
      eventData.description = args.description || existingEvent.description;

      // Preserve existing attendees unless new ones are provided
      if (args.attendees) {
        eventData.attendees = args.attendees.map((email: string) => ({ email }));
      } else if (existingEvent.attendees) {
        eventData.attendees = existingEvent.attendees;
      }

      // Preserve location unless new one is provided
      if (args.location) {
        eventData.location = args.location;
      } else if (existingEvent.location) {
        eventData.location = existingEvent.location;
      }

      // Handle time updates
      if (args.startTime) {
        const newStartTime = this.parseDateTime(args.startTime);
        eventData.start = {
          dateTime: newStartTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // If only startTime is provided, preserve the original duration
        if (!args.endTime && !args.duration) {
          const newEndTime = new Date(newStartTime.getTime() + existingDurationMinutes * 60 * 1000);
          eventData.end = {
            dateTime: newEndTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          };
        }
      } else if (args.endTime) {
        // Only end time provided, preserve start time
        eventData.start = existingEvent.start;
        eventData.end = {
          dateTime: this.parseDateTime(args.endTime).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      } else {
        // No time changes, preserve existing times
        eventData.start = existingEvent.start;
        eventData.end = existingEvent.end;
      }

      // Handle duration override if provided
      if (args.duration && args.startTime) {
        const start = this.parseDateTime(args.startTime);
        const durationMinutes = this.parseDurationToMinutes(args.duration);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        eventData.end = {
          dateTime: end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      const response = await window.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: eventData
      });

      const updatedEvent = response.result;

      let responseText = `✅ **Event Updated Successfully!**\n\n`;
      responseText += `📅 **${updatedEvent.summary}**\n`;
      responseText += `🕐 ${new Date(updatedEvent.start.dateTime).toLocaleString()}\n`;

      if (updatedEvent.end.dateTime) {
        responseText += `🕕 ${new Date(updatedEvent.end.dateTime).toLocaleString()}\n`;

        // Show duration if it was preserved
        if (args.startTime && !args.endTime && !args.duration) {
          const durationMinutes = Math.round((new Date(updatedEvent.end.dateTime).getTime() - new Date(updatedEvent.start.dateTime).getTime()) / (1000 * 60));
          responseText += `⏱️ Duration: ${durationMinutes} minutes (preserved from original event)\n`;
        }
      }

      return responseText;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      return "❌ I couldn't update the event. Please check your calendar permissions.";
    }
  }

  private async deleteCalendarEvent(args: any, events: CalendarEvent[]): Promise<string> {
    // Validate required fields and ask for missing information
    const validation = this.validateEventDelete(args);
    if (!validation.isValid) {
      return validation.message;
    }

    // Find the event using smart resolution
    const eventResolution = this.resolveEvent(args.eventId || args.eventTitle || args.summary, events);

    if (eventResolution.type === 'not_found') {
      return eventResolution.message;
    }

    if (eventResolution.type === 'multiple_found') {
      return eventResolution.message;
    }

    // Single event found, proceed with deletion
    const eventId = eventResolution.eventId;
    try {
      // First, get the event details to show what's being deleted
      const eventResponse = await window.gapi.client.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      const event = eventResponse.result;

      // Delete the event
      await window.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      let responseText = `🗑️ **Event Deleted Successfully!**\n\n`;
      responseText += `📅 **${event.summary}**\n`;
      responseText += `🕐 ${new Date(event.start.dateTime || event.start.date).toLocaleString()}\n`;
      responseText += `\nThe event has been removed from your calendar.`;

      return responseText;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      return "❌ I couldn't delete the event. Please check your calendar permissions.";
    }
  }

  private resolveEvent(searchQuery: string, events: CalendarEvent[]): { type: 'found' | 'multiple_found' | 'not_found', eventId?: string, message: string } {
    if (!searchQuery) {
      return {
        type: 'not_found',
        message: "❌ Please specify which event you want to modify. You can mention the event title, time, or describe the event."
      };
    }

    const searchLower = searchQuery.toLowerCase();

    // Try to find exact matches first
    const exactMatches = events.filter(event =>
      event.summary.toLowerCase() === searchLower
    );

    if (exactMatches.length === 1) {
      return {
        type: 'found',
        eventId: exactMatches[0].id,
        message: `Found event: ${exactMatches[0].summary}`
      };
    }

    if (exactMatches.length > 1) {
      return {
        type: 'multiple_found',
        message: this.formatEventOptions(exactMatches, "exact title matches")
      };
    }

    // Try partial matches
    const partialMatches = events.filter(event =>
      event.summary.toLowerCase().includes(searchLower) ||
      searchLower.includes(event.summary.toLowerCase())
    );

    if (partialMatches.length === 1) {
      return {
        type: 'found',
        eventId: partialMatches[0].id,
        message: `Found event: ${partialMatches[0].summary}`
      };
    }

    if (partialMatches.length > 1) {
      return {
        type: 'multiple_found',
        message: this.formatEventOptions(partialMatches, "partial title matches")
      };
    }

    // Try time-based matching
    const timeMatches = this.findEventsByTime(searchQuery, events);

    if (timeMatches.length === 1) {
      return {
        type: 'found',
        eventId: timeMatches[0].id,
        message: `Found event: ${timeMatches[0].summary}`
      };
    }

    if (timeMatches.length > 1) {
      return {
        type: 'multiple_found',
        message: this.formatEventOptions(timeMatches, "time matches")
      };
    }

    return {
      type: 'not_found',
      message: `❌ I couldn't find any events matching "${searchQuery}". Try being more specific with the event title or time.`
    };
  }

  private findEventsByTime(searchQuery: string, events: CalendarEvent[]): CalendarEvent[] {
    const matches: CalendarEvent[] = [];

    // Check for time patterns like "2pm", "2:30", "14:00", etc.
    const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const timeMatch = searchQuery.match(timePattern);

    if (!timeMatch) return matches;

    const [, hours, minutes, period] = timeMatch;
    let searchHour = parseInt(hours);
    const searchMinute = minutes ? parseInt(minutes) : 0;

    if (period?.toLowerCase() === 'pm' && searchHour !== 12) searchHour += 12;
    if (period?.toLowerCase() === 'am' && searchHour === 12) searchHour = 0;

    events.forEach(event => {
      if (event.start.dateTime) {
        const eventDate = new Date(event.start.dateTime);
        if (eventDate.getHours() === searchHour && eventDate.getMinutes() === searchMinute) {
          matches.push(event);
        }
      }
    });

    return matches;
  }

  private formatEventOptions(events: CalendarEvent[], matchType: string): string {
    let response = `🤔 **Multiple events found (${matchType}). Please clarify which one you mean:**\n\n`;

    events.forEach((event, index) => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '');
      const timeStr = event.start.dateTime
        ? eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'All day';
      const dateStr = eventDate.toLocaleDateString();

      response += `${index + 1}. **${event.summary}**\n`;
      response += `   🕐 ${dateStr} at ${timeStr}\n`;
      response += `   🆔 ID: \`${event.id}\`\n`;

      if (event.location) {
        response += `   📍 ${event.location}\n`;
      }

      response += '\n';
    });

    response += `💡 **How to specify:**\n`;
    response += `- Use the exact event title: "${events[0].summary}"\n`;
    response += `- Use the event ID: \`${events[0].id}\`\n`;
    response += `- Use the time: "${events[0].start.dateTime ? new Date(events[0].start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'All day'}"\n`;
    response += `- Be more specific with additional details`;

    return response;
  }

  private listUpcomingEvents(events: CalendarEvent[], timeframe?: string, filter?: string): string {
    let filteredEvents = [...events];

    // Apply timeframe filter using local time
    if (timeframe) {
      const now = this.getLocalNow();
      const today = this.getLocalToday();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      switch (timeframe.toLowerCase()) {
        case 'today':
          filteredEvents = filteredEvents.filter(event => {
            const eventDate = this.getLocalEventTime(event.start);
            return eventDate.toDateString() === today.toDateString();
          });
          break;
        case 'tomorrow':
          filteredEvents = filteredEvents.filter(event => {
            const eventDate = this.getLocalEventTime(event.start);
            return eventDate.toDateString() === tomorrow.toDateString();
          });
          break;
        case 'week':
        case 'this week':
          filteredEvents = filteredEvents.filter(event => {
            const eventDate = this.getLocalEventTime(event.start);
            return eventDate >= today && eventDate <= weekEnd;
          });
          break;
        case 'month':
          filteredEvents = filteredEvents.filter(event => {
            const eventDate = this.getLocalEventTime(event.start);
            return eventDate >= today && eventDate <= monthEnd;
          });
          break;
      }
    }

    // Apply keyword filter
    if (filter) {
      filteredEvents = filteredEvents.filter(event =>
        event.summary.toLowerCase().includes(filter.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(filter.toLowerCase()))
      );
    }

    if (filteredEvents.length === 0) {
      return `📅 No events found${timeframe ? ` for ${timeframe}` : ''}${filter ? ` matching "${filter}"` : ''}.`;
    }

    let response = `📅 **Upcoming Events**${timeframe ? ` (${timeframe})` : ''}${filter ? ` matching "${filter}"` : ''}:\n\n`;

    filteredEvents.forEach((event, index) => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '');
      const timeStr = event.start.dateTime
        ? eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : 'All day';

      response += `${index + 1}. **${event.summary}**\n`;
      response += `   🕐 ${eventDate.toLocaleDateString()} at ${timeStr}\n`;
      response += `   🆔 ID: ${event.id}\n`;

      if (event.location) {
        response += `   📍 ${event.location}\n`;
      }

      if (event.attendees && event.attendees.length > 0) {
        response += `   👥 ${event.attendees.length} attendee(s)\n`;
      }

      response += '\n';
    });

    response += `💡 **Tip**: You can reference events by their ID when updating or deleting them.`;

    return response;
  }

  private parseDateTime(dateTimeStr: string): Date {
    // Handle natural language dates using local time
    const now = this.getLocalNow();

    if (dateTimeStr.toLowerCase().includes('today')) {
      return this.parseTimeForDate(dateTimeStr, now);
    }

    if (dateTimeStr.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return this.parseTimeForDate(dateTimeStr, tomorrow);
    }

    // Try parsing as ISO date or standard date format
    const parsed = new Date(dateTimeStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try to extract time from the string and apply to today
    const timeMatch = dateTimeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      return this.parseTimeForDate(dateTimeStr, now);
    }

    // If we can't parse it, return current time as last resort
    return now;
  }

  private parseTimeForDate(dateTimeStr: string, baseDate: Date): Date {
    const timeMatch = dateTimeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      const [, hours, minutes, period] = timeMatch;
      let hour = parseInt(hours);
      const minute = minutes ? parseInt(minutes) : 0;

      if (period?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
      if (period?.toLowerCase() === 'am' && hour === 12) hour = 0;

      const date = new Date(baseDate);
      date.setHours(hour, minute, 0, 0);
      return date;
    }

    return new Date(baseDate);
  }

  private getTargetDate(preferredDate: string): Date {
    const now = this.getLocalNow();
    const today = this.getLocalToday();

    if (preferredDate.toLowerCase().includes('today')) {
      return today;
    }

    if (preferredDate.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    // Try parsing as ISO date or standard date format
    const parsed = new Date(preferredDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // If we can't parse it, return today as last resort
    return today;
  }

  private validateEventDelete(args: any): { isValid: boolean; message: string } {
    const missing: string[] = [];

    // Need to identify which event to delete
    if (!args.eventId && !args.eventTitle && !args.summary) {
      missing.push("event identification (which event do you want to delete?)");
    }

    // If there are missing fields, ask for them
    if (missing.length > 0) {
      let message = `❓ **I need to know which event to delete:**\n\n`;
      missing.forEach((field, index) => {
        message += `${index + 1}. ${field}\n`;
      });

      message += `\n💡 **Example:** "Delete the team meeting"`;
      message += `\n💡 **Or:** "Cancel my 2pm call"`;
      message += `\n💡 **Or:** "Remove the dentist appointment"`;

      return { isValid: false, message };
    }

    return { isValid: true, message: "" };
  }
}
