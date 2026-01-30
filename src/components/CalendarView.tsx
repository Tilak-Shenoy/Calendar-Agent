import React from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { CalendarEvent } from '../services/calendarService';
import { useAuth } from '../contexts/AuthContext';

interface CalendarViewProps {
  events: CalendarEvent[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ events }) => {
  const { calendarService } = useAuth();
  
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      if (event.start.dateTime) {
        const eventDate = new Date(event.start.dateTime);
        return isSameDay(eventDate, date);
      }
      return false;
    });
  };

  const formatEventTime = (dateTime: string) => {
    return format(new Date(dateTime), 'h:mm a');
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.summary.toLowerCase().includes('meeting')) return 'bg-blue-100 border-blue-300';
    if (event.summary.toLowerCase().includes('workout') || event.summary.toLowerCase().includes('gym')) return 'bg-green-100 border-green-300';
    if (event.summary.toLowerCase().includes('lunch') || event.summary.toLowerCase().includes('break')) return 'bg-yellow-100 border-yellow-300';
    return 'bg-gray-100 border-gray-300';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Your Calendar</h2>
      
      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`text-center p-2 rounded-lg ${
              isToday(day) ? 'bg-blue-50 font-bold' : ''
            }`}
          >
            <div className="text-sm text-gray-600">
              {format(day, 'EEE')}
            </div>
            <div className={`text-lg ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[200px] p-2 border rounded-lg ${
                isToday(day) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs p-1 rounded border ${getEventColor(event)} truncate`}
                    title={event.summary}
                  >
                    <div className="font-medium truncate">{event.summary}</div>
                    {event.start.dateTime && (
                      <div className="text-gray-600">
                        {formatEventTime(event.start.dateTime)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {calendarService && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Meeting Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const stats = calendarService.calculateMeetingStats(events);
              return (
                <>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalMeetings}</div>
                    <div className="text-sm text-gray-600">Total Meetings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.totalHours.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">Total Hours</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.averageMeetingDuration.toFixed(0)}m
                    </div>
                    <div className="text-sm text-gray-600">Avg Duration</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {Object.keys(stats.meetingsByDay).length}
                    </div>
                    <div className="text-sm text-gray-600">Active Days</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
