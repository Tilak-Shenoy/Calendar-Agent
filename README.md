# Calendar Agent

A React application that integrates with Google Calendar to provide intelligent calendar assistance through a conversational AI interface.

## Features


## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**
4. **Configure OAuth 2.0 Client ID**:
   - Go to "Credentials" → "OAuth 2.0 Client IDs"
   - Click "Edit" your existing client ID
   - **Authorized JavaScript origins**: Add `http://localhost:3000`
   - **Authorized redirect URIs**: Add `http://localhost:3000`

5. **Test the consent screen**:
   - Go to "OAuth consent screen"
   - Make sure it's configured for "External" users
   - Add required scopes:
     - `https://www.googleapis.com/auth/calendar` (Full calendar access)
     - `https://www.googleapis.com/auth/calendar.events` (Event management)

### 2. OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key for use in environment configuration

### 3. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in `.env`:
   ```
   REACT_APP_GOOGLE_CLIENT_ID=your_actual_client_id_here
   REACT_APP_GOOGLE_API_KEY=your_actual_api_key_here
   REACT_APP_OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage Examples

### Calendar Analysis
Ask questions like:
- "How much of my time am I spending in meetings?"
- "How would you recommend I decrease that?"
- "What does my week look like?"
- "Generate email drafts for scheduling meetings with my team"

### Calendar Management
Manage your calendar with natural language commands:
- "Create a meeting with John tomorrow at 2pm"
- "Schedule a workout session today at 6am with reminder 15 minutes before"
- "Create a team meeting tomorrow at 2pm for 1 hour with john@example.com, sarah@example.com"
- "Update my meeting with John to 3pm"
- "Move the team standup to 10am"
- "Reschedule my 2pm meeting to tomorrow at 4pm"
- "Change the client call to 1pm for 2 hours"
- "Cancel the dentist appointment"
- "Show me my events for this week"
- "List all meetings for today"
- "Check for conflicts this week"


### Conflict Detection
Find overlapping events in your calendar:
- "Check for conflicts today"
- "Show me conflicts this week"
- "Are there any scheduling conflicts tomorrow?"
- "Find conflicts for this month"

### Time Slot Finding
Find available time slots that avoid conflicts:
- "Find time for a 1 hour meeting today"
- "When can I schedule a 30 minute call tomorrow morning?"
- "Show me available slots for a 2 hour meeting this afternoon"
- "Find time for team lunch tomorrow between 12pm-2pm"

### Email Drafting
Request email drafts:
- "I have three meetings I need to schedule with Joe, Dan, and Sally. I really want to block my mornings off to work out, so can you write me an email draft I can share with each of them?"


## Available Scripts

- `npm start` - Run development server
- `npm run build` - Build for production
