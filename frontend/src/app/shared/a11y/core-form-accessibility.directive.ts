import { Directive, ElementRef, inject, type AfterViewInit, type OnDestroy } from '@angular/core';

/**
 * Compatibility repair for Core form controls that currently mark their editable wrapper as hidden.
 * Keep this local until the upstream components stop rendering `aria-hidden="true"` on form fields.
 */
@Directive({
  selector: 'sd-input, sd-input-number, sd-textarea',
})
export class CoreFormAccessibilityDirective implements AfterViewInit, OnDestroy {
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  #observer?: MutationObserver;

  ngAfterViewInit(): void {
    this.#exposeEditableControl();
    this.#observer = new MutationObserver(() => this.#exposeEditableControl());
    this.#observer.observe(this.#host.nativeElement, {
      attributes: true,
      attributeFilter: ['aria-hidden'],
      childList: true,
      subtree: true,
    });
  }

  ngOnDestroy(): void {
    this.#observer?.disconnect();
  }

  #exposeEditableControl(): void {
    const host = this.#host.nativeElement;
    host
      .querySelectorAll<HTMLElement>(
        ':scope > div[aria-hidden="true"], input[aria-hidden="true"], textarea[aria-hidden="true"]',
      )
      .forEach((element) => element.removeAttribute('aria-hidden'));
  }
}
