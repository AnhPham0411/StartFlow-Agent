import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'primary', fullWidth = false, className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`button button--${variant}${fullWidth ? ' button--full' : ''} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});
