import { InjectionToken } from '@angular/core';
import type { AppEnvironment } from '../../../environments/environment.model';

/** Provides the Angular-selected public environment to application services. */
export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('startflow.environment');
