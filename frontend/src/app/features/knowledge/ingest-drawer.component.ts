import { DOCUMENT } from '@angular/common';
import { ConfigurableFocusTrapFactory, type ConfigurableFocusTrap } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  type OnDestroy,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSideDrawer } from '@sdcorejs/angular/components/side-drawer';
import { SdInput } from '@sdcorejs/angular/forms/input';
import { SdSelect } from '@sdcorejs/angular/forms/select';
import { SdTextarea } from '@sdcorejs/angular/forms/textarea';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { KnowledgeDocument } from '../../core/api/models';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import { CoreFormAccessibilityDirective } from '../../shared/a11y/core-form-accessibility.directive';

type KnowledgeDomain = 'CREDIT' | 'COMPLIANCE' | 'OPERATIONS';

interface DomainOption {
  value: KnowledgeDomain;
  label: string;
}

@Component({
  selector: 'app-ingest-drawer',
  imports: [
    ReactiveFormsModule,
    SdButton,
    SdInform,
    SdInput,
    SdSelect,
    SdSideDrawer,
    SdTextarea,
    CoreFormAccessibilityDirective,
  ],
  templateUrl: './ingest-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngestDrawerComponent implements OnDestroy {
  readonly #api = inject(StartFlowApiService);
  readonly #notify = inject(SdNotifyService);
  readonly #document = inject(DOCUMENT);
  readonly #focusTrapFactory = inject(ConfigurableFocusTrapFactory);
  private readonly drawer = viewChild.required(SdSideDrawer);
  #drawerElement?: HTMLElement;
  #focusTrap?: ConfigurableFocusTrap;
  #previouslyFocused?: HTMLElement;
  #animationFrameId?: number;

  readonly ingested = output<KnowledgeDocument>();
  readonly form = new FormGroup({});
  readonly title = signal('');
  readonly domain = signal<KnowledgeDomain>('CREDIT');
  readonly content = signal('');
  readonly saving = signal(false);
  readonly validationAttempted = signal(false);

  readonly domainOptions: DomainOption[] = [
    { value: 'CREDIT', label: 'Tín dụng' },
    { value: 'COMPLIANCE', label: 'Tuân thủ' },
    { value: 'OPERATIONS', label: 'Vận hành' },
  ];

  readonly contentError = computed(() => {
    if (!this.validationAttempted() || this.content().trim().length >= 20) return undefined;
    return 'Nội dung cần ít nhất 20 ký tự.';
  });

  readonly titleError = computed(() => {
    if (!this.validationAttempted() || this.title().trim().length >= 3) return undefined;
    return 'Tiêu đề cần ít nhất 3 ký tự.';
  });

  open(): void {
    const activeElement = this.#document.activeElement;
    this.#previouslyFocused = activeElement instanceof HTMLElement ? activeElement : undefined;
    this.drawer().open();
    queueMicrotask(() => this.#activateDialog());
  }

  close(): void {
    if (this.saving()) return;
    this.drawer().close();
  }

  handleClosed(): void {
    this.#deactivateDialog(true);
  }

  ngOnDestroy(): void {
    this.#deactivateDialog(false);
  }

  setTitle(value: string | null | undefined): void {
    this.title.set(value ?? '');
  }

  setDomain(value: unknown): void {
    if (value === 'CREDIT' || value === 'COMPLIANCE' || value === 'OPERATIONS') {
      this.domain.set(value);
    }
  }

  setContent(value: string | null | undefined): void {
    this.content.set(value ?? '');
  }

  async submit(): Promise<void> {
    if (this.saving()) return;

    this.validationAttempted.set(true);
    this.form.markAllAsTouched();
    const title = this.title().trim();
    const content = this.content().trim();
    if (title.length < 3 || content.length < 20) {
      this.#notify.error('Tiêu đề cần ít nhất 3 ký tự và nội dung cần ít nhất 20 ký tự.', {
        title: 'Tài liệu chưa hợp lệ',
      });
      return;
    }

    this.saving.set(true);
    try {
      const document = await this.#api.ingestKnowledge({
        title,
        domain: this.domain(),
        content,
        demoData: true,
      });
      this.#notify.success('Đã gửi tài liệu demo vào hàng đợi ingest.', {
        title: 'Ingest thành công',
      });
      this.ingested.emit(document);
      this.drawer().close();
      this.#reset();
    } catch {
      this.#notify.error('Không thể ingest tài liệu. Hãy kiểm tra kết nối dịch vụ và thử lại.', {
        title: 'Ingest thất bại',
      });
    } finally {
      this.saving.set(false);
    }
  }

  #reset(): void {
    this.title.set('');
    this.domain.set('CREDIT');
    this.content.set('');
    this.validationAttempted.set(false);
    this.form.reset();
  }

  #activateDialog(attempt = 0): void {
    const drawerElement = this.#document.querySelector<HTMLElement>(
      '[data-autoid="components-side-drawer-knowledge-ingest"]',
    );
    if (!drawerElement || drawerElement.dataset['opened'] !== 'true') {
      if (attempt < 3) {
        this.#animationFrameId = requestAnimationFrame(() => this.#activateDialog(attempt + 1));
      }
      return;
    }

    this.#drawerElement = drawerElement;
    const title = drawerElement.querySelector<HTMLElement>('.sd-side-drawer-title');
    if (title) {
      title.id = 'knowledge-ingest-dialog-title';
      drawerElement.setAttribute('aria-labelledby', title.id);
    } else {
      drawerElement.setAttribute('aria-label', 'Ingest tài liệu demo');
    }
    drawerElement.setAttribute('role', 'dialog');
    drawerElement.setAttribute('aria-modal', 'true');
    drawerElement
      .querySelector<HTMLButtonElement>('.sd-side-drawer-close-btn')
      ?.setAttribute('aria-label', 'Đóng ngăn ingest');
    drawerElement.addEventListener('keydown', this.#onDrawerKeydown);

    this.#focusTrap?.destroy();
    this.#focusTrap = this.#focusTrapFactory.create(drawerElement, { defer: false });
    void this.#focusTrap.focusInitialElementWhenReady();
  }

  #deactivateDialog(restoreFocus: boolean): void {
    if (this.#animationFrameId !== undefined) cancelAnimationFrame(this.#animationFrameId);
    this.#animationFrameId = undefined;
    this.#focusTrap?.destroy();
    this.#focusTrap = undefined;
    this.#drawerElement?.removeEventListener('keydown', this.#onDrawerKeydown);
    this.#drawerElement?.removeAttribute('role');
    this.#drawerElement?.removeAttribute('aria-modal');
    this.#drawerElement?.removeAttribute('aria-labelledby');
    this.#drawerElement?.removeAttribute('aria-label');
    this.#drawerElement = undefined;

    const previousFocus = this.#previouslyFocused;
    this.#previouslyFocused = undefined;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
  }

  readonly #onDrawerKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.saving()) return;
    event.preventDefault();
    event.stopPropagation();
    this.drawer().close();
  };
}
