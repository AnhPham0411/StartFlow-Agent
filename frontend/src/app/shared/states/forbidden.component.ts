import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, SdInform, SdPageComponent],
  template: `
    <sd-page>
      <div headerLeft class="d-flex flex-column">
        <h1 class="T20M m-0">Không có quyền truy cập</h1>
      </div>
      <div class="d-flex flex-column gap-16 p-24">
        <sd-inform
          warning
          title="Bạn không có quyền mở nội dung này"
          description="Hãy quay lại không gian làm việc hoặc liên hệ quản trị viên nếu bạn cần thêm quyền."
        ></sd-inform>
        <a routerLink="/dashboard">Quay lại tổng quan</a>
      </div>
    </sd-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {}
