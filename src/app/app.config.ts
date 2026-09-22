import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    
    // เหลือ provideRouter ไว้แค่อันเดียวที่รวบรวมฟังก์ชันการตั้งค่าทั้งหมดครับ
    provideRouter(
      routes, 
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })
    ),
    
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
};
