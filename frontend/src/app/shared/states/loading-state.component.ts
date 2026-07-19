import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { SdLoadingService } from '@sdcorejs/angular/services/loading';

let nextLoadingId = 0;

@Component({
  selector: 'app-loading-state',
  template: `
    <div
      class="d-flex justify-content-center align-items-center position-relative p-24"
      style="min-height: 7rem"
      [id]="loadingId"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span>{{ label() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent implements AfterViewInit, OnDestroy {
  readonly #loadingService = inject(SdLoadingService);
  readonly loadingId = `startflow-loading-${nextLoadingId++}`;
  readonly label = input('Đang tải dữ liệu…');

  ngAfterViewInit(): void {
    this.#loadingService.start(this.#selector);
  }

  ngOnDestroy(): void {
    this.#loadingService.stop(this.#selector);
  }

  get #selector(): string {
    return `#${this.loadingId}`;
  }
}
