import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthButton from './components/AuthButton';
import CalendarView from './components/CalendarView';
import ChatInterface from './components/ChatInterface';
import { CalendarAgent } from './services/calendarAgent';
import { Calendar, MessageCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, error, events } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'calendar' | 'chat'>('calendar');

  const handleChatMessage = async (message: string): Promise<string> => {
    const agent = new CalendarAgent(events);
    return await agent.processMessage(message);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Calendar Agent...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Configuration Error</h2>
          <p className="text-red-600 text-sm">{error}</p>
          <p className="text-red-500 text-xs mt-2">
            Please set up your Google OAuth credentials in the environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Calendar Agent</h1>
            <p className="text-gray-600">
              Connect your Google Calendar to analyze your schedule and get intelligent assistance.
            </p>
          </div>
          <div className="flex justify-center">
            <AuthButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Calendar Agent</h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Calendar
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'chat'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <MessageCircle className="w-4 h-4 inline mr-1" />
                  Assistant
                </button>
              </div>

              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'calendar' ? (
          <CalendarView events={events} />
        ) : (
          <ChatInterface onSendMessage={handleChatMessage} />
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
