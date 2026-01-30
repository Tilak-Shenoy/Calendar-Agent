import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { GoogleAuthService, GoogleAuthConfig } from '../services/googleAuth';
import { CalendarService, CalendarEvent } from '../services/calendarService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  events: CalendarEvent[];
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  calendarService: CalendarService | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_AUTH_CONFIG: GoogleAuthConfig = {
  clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
  apiKey: process.env.REACT_APP_GOOGLE_API_KEY || '',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [authService, setAuthService] = useState<GoogleAuthService | null>(null);
  const [calendarService, setCalendarService] = useState<CalendarService | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        if (!GOOGLE_AUTH_CONFIG.clientId || !GOOGLE_AUTH_CONFIG.apiKey) {
          throw new Error('Google OAuth configuration is missing. Please set REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY environment variables.');
        }

        const auth = new GoogleAuthService(GOOGLE_AUTH_CONFIG);
        setAuthService(auth);
        setCalendarService(new CalendarService());

        // Load Google APIs
        await loadGoogleApis();
        await auth.initializeGapi();
        await auth.initializeGis();

        // Check if already signed in
        if (auth.isSignedIn()) {
          setIsAuthenticated(true);
          await refreshEvents();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    };

    initializeServices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGoogleApis = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = () => resolve();
        gisScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(gisScript);
      };
      script.onerror = () => reject(new Error('Failed to load Google APIs'));
      document.head.appendChild(script);
    });
  };

  const signIn = async () => {
    if (!authService) return;

    try {
      setIsLoading(true);
      setError(null);
      await authService.signIn();
      const isSignedIn = authService.isSignedIn();
      if (isSignedIn) {
        setIsAuthenticated(true);
        const service = new CalendarService();
        setCalendarService(service);
        await refreshEvents();
        startAutoRefresh(); // Start auto-refresh when signed in
      } else {
        setIsAuthenticated(false);
        setEvents([]);
        stopAutoRefresh(); // Stop auto-refresh when signed out
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    if (!authService) return;

    try {
      setIsLoading(true);
      setError(null);
      await authService.signOut();
      setIsAuthenticated(false);
      setEvents([]);
      stopAutoRefresh(); // Stop auto-refresh when signing out
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshEvents = async () => {
    if (!calendarService) return;

    try {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

      const calendarEvents = await calendarService.getEvents(timeMin, timeMax);
      setEvents(calendarEvents);
      setError(null);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError('Failed to fetch calendar events');
    }
  };

  const startAutoRefresh = () => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval to refresh every minute
    refreshIntervalRef.current = setInterval(() => {
      refreshEvents();
    }, 15000); // 15 seconds
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    error,
    events,
    signIn,
    signOut,
    refreshEvents,
    calendarService,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
