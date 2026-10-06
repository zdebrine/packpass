import * as WebBrowser from 'expo-web-browser';

/** The public website, which hosts the membership terms, privacy policy and support page. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://packpass-landing.vercel.app').replace(/\/$/, '');

/** Opens /terms, /privacy or /support in an in-app browser sheet (a new tab on the web). */
export const openSite = (path: '/terms' | '/privacy' | '/support') => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`).catch(() => undefined);
