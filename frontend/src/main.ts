import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { createAppConfig } from './app/app.config';
import { appRoutes } from './app/app.routes';

bootstrapApplication(AppComponent, createAppConfig(appRoutes))
  .catch((error: unknown) => {
    console.error('StartFlow bootstrap failed.', error);
    document.body.textContent = 'StartFlow không thể khởi động. Vui lòng liên hệ quản trị viên.';
  });
