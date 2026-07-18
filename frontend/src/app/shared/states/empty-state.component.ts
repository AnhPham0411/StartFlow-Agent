import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SdInform } from '@sdcorejs/angular/components/inform';

@Component({
  selector: 'app-empty-state',
  imports: [SdInform],
  template: `
    <sd-inform
      secondary
      icon="inbox"
      [title]="title()"
      [description]="description()"
      [actionLabel]="actionLabel() || undefined"
      (sdAction)="primaryAction.emit()"
    ></sd-inform>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly title = input('Chưa có dữ liệu');
  readonly description = input('Dữ liệu sẽ xuất hiện tại đây khi sẵn sàng.');
  readonly actionLabel = input('');
  readonly primaryAction = output<void>();
}
