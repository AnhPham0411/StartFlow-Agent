'use client';

import { caseInputSchema, type CaseInput } from '@startflow/contracts';
import { Check, FlaskConical, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/src/components/ui/button';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { demoFixtures, documentOptions } from '@/src/lib/demo-fixtures';
import { formatCurrency } from '@/src/lib/format';
import { useStartFlowApi } from '@/src/lib/use-api';

type FieldErrors = Record<string, string>;

export function IntakeForm() {
  const api = useStartFlowApi();
  const router = useRouter();
  const [input, setInput] = useState<CaseInput>(demoFixtures[0]!.input);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const setRoot = <K extends keyof CaseInput>(key: K, value: CaseInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));
  const setFinancial = (key: keyof CaseInput['financials'], value: number) =>
    setInput((current) => ({ ...current, financials: { ...current.financials, [key]: value } }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setRequestError(null);
    const parsed = caseInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const created = await api.createCase(parsed.data);
      router.push(`/cases/${created.id}`);
    } catch {
      setRequestError('Không thể lưu hồ sơ. Kiểm tra kết nối API và thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  function selectFixture(index: number) {
    setInput(structuredClone(demoFixtures[index]!.input));
    setErrors({});
    setRequestError(null);
  }
  function toggleDocument(document: string) {
    setRoot(
      'submittedDocuments',
      input.submittedDocuments.includes(document)
        ? input.submittedDocuments.filter((item) => item !== document)
        : [...input.submittedDocuments, document],
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Safe demo intake"
        title="Tạo hồ sơ đánh giá"
        description="Chỉ dùng dữ liệu doanh nghiệp hư cấu. Form được kiểm tra theo shared contract trước khi gửi."
      />
      <div className="banner banner--info">
        <FlaskConical aria-hidden="true" />
        <p>
          <strong>Chọn fixture để demo nhanh:</strong>{' '}
          {demoFixtures.map((fixture, index) => (
            <Button
              key={fixture.id}
              variant="ghost"
              onClick={() => selectFixture(index)}
              style={{ marginLeft: 8 }}
            >
              {fixture.label}
            </Button>
          ))}
        </p>
      </div>
      {requestError ? (
        <div className="banner banner--danger" role="alert">
          <p>{requestError}</p>
        </div>
      ) : null}
      <form onSubmit={(event) => void submit(event)}>
        <div className="section-grid">
          <div className="list-stack">
            <Panel>
              <PanelHeader title="Doanh nghiệp và khoản vay" eyebrow="01 · Intake" />
              <PanelBody>
                <div className="form-grid">
                  <Field id="companyName" label="Tên doanh nghiệp" error={errors.companyName}>
                    <input
                      className="input"
                      id="companyName"
                      aria-invalid={Boolean(errors.companyName)}
                      value={input.companyName}
                      onChange={(event) => setRoot('companyName', event.target.value)}
                    />
                  </Field>
                  <Field
                    id="registrationNumber"
                    label="Mã đăng ký"
                    error={errors.registrationNumber}
                  >
                    <input
                      className="input utility"
                      id="registrationNumber"
                      aria-invalid={Boolean(errors.registrationNumber)}
                      value={input.registrationNumber}
                      onChange={(event) => setRoot('registrationNumber', event.target.value)}
                    />
                  </Field>
                  <Field
                    id="requestedAmount"
                    label="Số tiền đề nghị (VND)"
                    error={errors.requestedAmount}
                  >
                    <input
                      className="input"
                      id="requestedAmount"
                      type="number"
                      min="1"
                      value={input.requestedAmount}
                      onChange={(event) => setRoot('requestedAmount', Number(event.target.value))}
                    />
                  </Field>
                  <Field id="purpose" label="Mục đích vay" error={errors.purpose} wide>
                    <textarea
                      className="textarea"
                      id="purpose"
                      aria-invalid={Boolean(errors.purpose)}
                      value={input.purpose}
                      onChange={(event) => setRoot('purpose', event.target.value)}
                    />
                  </Field>
                </div>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Ảnh chụp tài chính" eyebrow="02 · Financial snapshot" />
              <PanelBody>
                <div className="form-grid">
                  {(
                    [
                      ['revenue', 'Doanh thu'],
                      ['ebitda', 'EBITDA'],
                      ['totalDebt', 'Tổng nợ'],
                      ['equity', 'Vốn chủ sở hữu'],
                      ['currentAssets', 'Tài sản ngắn hạn'],
                      ['currentLiabilities', 'Nợ ngắn hạn'],
                    ] as const
                  ).map(([key, label]) => (
                    <Field
                      key={key}
                      id={key}
                      label={`${label} (VND)`}
                      error={errors[`financials.${key}`]}
                    >
                      <input
                        className="input"
                        id={key}
                        type="number"
                        min={key === 'ebitda' ? undefined : 0}
                        value={input.financials[key]}
                        onChange={(event) => setFinancial(key, Number(event.target.value))}
                      />
                    </Field>
                  ))}
                </div>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Tài liệu đã nộp" eyebrow="03 · Document checklist" />
              <PanelBody>
                <fieldset>
                  <legend className="fieldset-label">Chọn tất cả tài liệu đã có</legend>
                  <div className="checkbox-list">
                    {documentOptions.map((document) => (
                      <label className="checkbox-row" key={document}>
                        <input
                          type="checkbox"
                          checked={input.submittedDocuments.includes(document)}
                          onChange={() => toggleDocument(document)}
                        />
                        {document}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </PanelBody>
            </Panel>
          </div>
          <Panel className="sticky-panel">
            <PanelHeader title="Tóm tắt trước khi lưu" eyebrow="DEMO_DATA" />
            <PanelBody>
              <h2>{input.companyName}</h2>
              <p className="utility muted">{input.registrationNumber}</p>
              <p>
                <strong>{formatCurrency(input.requestedAmount)}</strong>
              </p>
              <p className="muted">{input.purpose}</p>
              <ul className="condition-list">
                <li>{input.submittedDocuments.length} tài liệu đã chọn</li>
                <li>Doanh thu {formatCurrency(input.financials.revenue)}</li>
                <li>Dữ liệu được gắn nhãn demo</li>
              </ul>
              <Button type="submit" fullWidth disabled={submitting}>
                <Save aria-hidden="true" /> {submitting ? 'Đang lưu…' : 'Lưu hồ sơ demo'}
              </Button>
              <p className="field-help" style={{ marginTop: 10 }}>
                <Check aria-hidden="true" style={{ width: 15 }} /> Không gửi dữ liệu tới AI cho đến
                khi bạn chủ động bắt đầu đánh giá.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  error,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`form-field${wide ? ' form-field--wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
