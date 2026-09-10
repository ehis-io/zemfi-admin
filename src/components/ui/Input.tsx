import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex w-full flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input-field ${error ? 'border-danger focus:border-danger' : ''} ${className}`}
          {...props}
        />
        {error && <span className="text-xs font-medium text-danger">{error}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
