import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type ElementRef,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdCheckbox } from '@sdcorejs/angular/forms/checkbox';
import { SdInput } from '@sdcorejs/angular/forms/input';
import { SdInputNumber } from '@sdcorejs/angular/forms/input-number';
import { SdTextarea } from '@sdcorejs/angular/forms/textarea';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import { caseInputSchema, type CaseInput } from '@startflow/contracts';
import { StartFlowApiService } from '../../../core/api/startflow-api.service';
import { CoreFormAccessibilityDirective } from '../../../shared/a11y/core-form-accessibility.directive';
import { formatCurrency } from '../../../shared/formatters';
import { caseDemoFixtures, caseDocumentOptions } from './case-fixtures';

type RootField = 'companyName' | 'registrationNumber' | 'requestedAmount' | 'purpose';
type FinancialField = keyof CaseInput['financials'];
type FieldErrors = Readonly<Record<string, string>>;

interface DocumentOptionViewModel {
  label: string;
  selected: boolean;
}

const FIELD_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  companyName: 'Tên doanh nghiệp phải có từ 2 đến 160 ký tự.',
  registrationNumber: 'Mã đăng ký phải có từ 4 đến 32 ký tự.',
  requestedAmount: 'Số tiền đề nghị phải lớn hơn 0.',
  purpose: 'Mục đích vay phải có từ 10 đến 1.000 ký tự.',
  'financials.revenue': 'Doanh thu không được âm.',
  'financials.ebitda': 'EBITDA phải là một số hợp lệ.',
  'financials.totalDebt': 'Tổng nợ không được âm.',
  'financials.equity': 'Vốn chủ sở hữu phải lớn hơn 0.',
  'financials.currentAssets': 'Tài sản ngắn hạn không được âm.',
  'financials.currentLiabilities': 'Nợ ngắn hạn phải lớn hơn 0.',
  submittedDocuments: 'Danh sách tài liệu chưa hợp lệ.',
};

@Component({
  selector: 'app-case-intake',
  imports: [
    SdButton,
    SdCheckbox,
    SdInform,
    SdInput,
    SdInputNumber,
    SdSection,
    SdTextarea,
    SdPageComponent,
    CoreFormAccessibilityDirective,
  ],
  templateUrl: './case-intake.component.html',
  styleUrl: './case-intake.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: CaseIntakeComponent,
  name: 'Tạo hồ sơ',
  icon: 'note_add',
  color: 'primary',
})
export class CaseIntakeComponent {
  readonly #api = inject(StartFlowApiService);
  readonly #router = inject(Router);
  readonly #notify = inject(SdNotifyService);

  readonly fixtures = caseDemoFixtures;
  readonly selectedFixtureId = signal(caseDemoFixtures[0]?.id ?? null);
  readonly input = signal<CaseInput>(cloneInput(caseDemoFixtures[0]!.input));
  readonly errors = signal<FieldErrors>({});
  readonly submitting = signal(false);
  readonly requestError = signal<string | null>(null);
  readonly validationSummary = viewChild<ElementRef<HTMLElement>>('validationSummary');
  readonly validationSummaryText = computed(() => Object.values(this.errors()).join(' '));

  readonly documents = computed<DocumentOptionViewModel[]>(() =>
    caseDocumentOptions.map((label) => ({
      label,
      selected: this.input().submittedDocuments.includes(label),
    })),
  );

  readonly summary = computed(() => ({
    companyName: this.input().companyName || 'Chưa nhập tên doanh nghiệp',
    registrationNumber: this.input().registrationNumber || 'Chưa có mã đăng ký',
    requestedAmount: formatCurrency(this.input().requestedAmount),
    purpose: this.input().purpose || 'Chưa nhập mục đích vay.',
    documentCount: this.input().submittedDocuments.length,
    revenue: formatCurrency(this.input().financials.revenue),
  }));

  updateRoot(field: RootField, value: unknown): void {
    this.selectedFixtureId.set(null);
    this.input.update((current) => ({
      ...current,
      [field]: field === 'requestedAmount' ? toNumber(value) : String(value ?? ''),
    }));
    this.clearFieldError(field);
  }

  updateFinancial(field: FinancialField, value: unknown): void {
    this.selectedFixtureId.set(null);
    this.input.update((current) => ({
      ...current,
      financials: { ...current.financials, [field]: toNumber(value) },
    }));
    this.clearFieldError(`financials.${field}`);
  }

  toggleDocument(document: string, selected: unknown): void {
    this.selectedFixtureId.set(null);
    this.input.update((current) => ({
      ...current,
      submittedDocuments: selected
        ? [...new Set([...current.submittedDocuments, document])]
        : current.submittedDocuments.filter((item) => item !== document),
    }));
    this.clearFieldError('submittedDocuments');
  }

  selectFixture(fixtureId: string): void {
    const fixture = caseDemoFixtures.find((item) => item.id === fixtureId);
    if (!fixture) return;
    this.selectedFixtureId.set(fixture.id);
    this.input.set(cloneInput(fixture.input));
    this.errors.set({});
    this.requestError.set(null);
  }

  async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.submitting()) return;

    this.requestError.set(null);
    const parsed = caseInputSchema.safeParse(this.input());
    if (!parsed.success) {
      this.errors.set(
        Object.fromEntries(
          parsed.error.issues.map((issue) => {
            const path = issue.path.join('.');
            return [path, FIELD_ERROR_MESSAGES[path] ?? 'Thông tin chưa hợp lệ.'];
          }),
        ),
      );
      this.#notify.warning('Vui lòng kiểm tra các trường được đánh dấu.');
      setTimeout(() => this.validationSummary()?.nativeElement.focus());
      return;
    }

    this.errors.set({});
    this.submitting.set(true);
    try {
      const created = await this.#api.createCase(parsed.data);
      this.#notify.success('Đã tạo hồ sơ demo thành công.');
      await this.#router.navigate(['/cases', created.id]);
    } catch {
      const message = 'Không thể lưu hồ sơ. Vui lòng kiểm tra kết nối API và thử lại.';
      this.requestError.set(message);
      this.#notify.error(message);
    } finally {
      this.submitting.set(false);
    }
  }

  private clearFieldError(path: string): void {
    if (!this.errors()[path]) return;
    const next = { ...this.errors() };
    delete next[path];
    this.errors.set(next);
  }
}

function cloneInput(input: CaseInput): CaseInput {
  return {
    ...input,
    financials: { ...input.financials },
    submittedDocuments: [...input.submittedDocuments],
  };
}

function toNumber(value: unknown): number {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
