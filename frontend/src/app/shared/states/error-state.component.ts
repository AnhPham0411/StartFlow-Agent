import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SdInform } from '@sdcorejs/angular/components/inform';

@Component({
  selector: 'app-error-state',
  imports: [SdInform],
  template: `
    <sd-inform
      error
      [title]="title()"
      [description]="description()"
      actionLabel="Thử lại"
      (sdAction)="retry.emit()"
    ></sd-inform>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly title = input('Không tải được dữ liệu');
  readonly description = input('Máy chủ chưa phản hồi. Vui lòng thử lại.');
  readonly retry = output<void>();
}
