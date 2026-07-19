import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, SdInform, SdPageComponent],
  template: `
    <sd-page>
      <div headerLeft class="d-flex flex-column">
        <h1 class="T20M m-0">Không tìm thấy trang</h1>
      </div>
      <div class="d-flex flex-column gap-16 p-24">
        <sd-inform
          info
          title="Đường dẫn không tồn tại"
          description="Trang có thể đã được di chuyển hoặc đường dẫn chưa chính xác."
        ></sd-inform>
        <a routerLink="/dashboard">Quay lại tổng quan</a>
      </div>
    </sd-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
