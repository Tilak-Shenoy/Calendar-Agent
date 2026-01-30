export interface GoogleAuthConfig {
  clientId: string;
  apiKey: string;
  discoveryDocs: string[];
  scopes: string[];
}

export class GoogleAuthService {
  private config: GoogleAuthConfig;
  private tokenClient: any = null;
  private gapiInited = false;
  private gisInited = false;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
  }

  async initializeGapi() {
    return new Promise((resolve) => {
      if (window.gapi) {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: this.config.apiKey,
              discoveryDocs: this.config.discoveryDocs,
            });
            this.gapiInited = true;
            resolve(true);
          } catch (error) {
            console.error('Error initializing GAPI client:', error);
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
    });
  }

  async initializeGis() {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.config.clientId,
          scope: this.config.scopes.join(' '),
          callback: '', // Will be set later
        });
        this.gisInited = true;
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  async signIn(): Promise<string> {
    if (!this.gapiInited || !this.gisInited) {
      throw new Error('Google services not initialized');
    }

    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
        } else {
          resolve(tokenResponse.access_token);
        }
      };

      this.tokenClient.requestAccessToken();
    });
  }

  async signOut() {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken('');
    }
  }

  isSignedIn(): boolean {
    const token = window.gapi.client.getToken();
    return !!token?.access_token;
  }

  getAccessToken(): string | null {
    const token = window.gapi.client.getToken();
    return token?.access_token || null;
  }
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
