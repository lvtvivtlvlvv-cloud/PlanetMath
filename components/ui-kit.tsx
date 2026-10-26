'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check } from 'lucide-react';
import { useAppTheme } from './theme-context';

// ============================================================================
// 1. <Button />
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'full' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      className = '',
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    const { isLight } = useAppTheme();

    const baseClasses =
      'rounded-xl inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 ease-out select-none cursor-pointer shrink-0 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40';

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-sky-600 text-white hover:bg-sky-500 border border-sky-500/30 shadow-xs shadow-sky-600/20',
      secondary: isLight
        ? 'bg-slate-100 text-slate-800 hover:bg-slate-200/80 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
        : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
      outline: isLight
        ? 'bg-transparent text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 border border-slate-200 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800/70'
        : 'bg-transparent text-slate-200 hover:bg-slate-800/70 hover:text-white border border-slate-700',
      ghost: isLight
        ? 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent dark:text-slate-300 dark:hover:bg-slate-800'
        : 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent',
      danger: isLight
        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
        : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30',
    };

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-5 text-base',
      full: 'h-11 px-4 text-sm w-full',
      icon: 'h-8 w-8 p-0',
    };

    const widthClass = fullWidth || size === 'full' ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type={type}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ============================================================================
// 2. <Input /> & <Textarea />
// ============================================================================

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon, rightElement, className = '', wrapperClassName = '', ...props }, ref) => {
    const { isLight } = useAppTheme();

    const surfaceClasses = isLight
      ? 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
      : 'bg-slate-900/90 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';

    const inputClasses = `h-11 w-full rounded-xl border px-3.5 text-sm transition-all duration-200 ease-out outline-none disabled:opacity-50 ${surfaceClasses} ${
      icon ? 'pl-10' : ''
    } ${rightElement ? 'pr-10' : ''} ${className}`;

    if (icon || rightElement) {
      return (
        <div className={`relative flex items-center w-full ${wrapperClassName}`}>
          {icon && (
            <span className="pointer-events-none absolute left-3.5 flex items-center justify-center text-slate-400">
              {icon}
            </span>
          )}
          <input ref={ref} className={inputClasses} {...props} />
          {rightElement && (
            <div className="absolute right-2.5 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
      );
    }

    return <input ref={ref} className={inputClasses} {...props} />;
  }
);
Input.displayName = 'Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => {
    const { isLight } = useAppTheme();

    const surfaceClasses = isLight
      ? 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
      : 'bg-slate-900/90 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';

    return (
      <textarea
        ref={ref}
        className={`w-full rounded-xl border p-3.5 text-sm transition-all duration-200 ease-out outline-none disabled:opacity-50 ${surfaceClasses} ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

// ============================================================================
// 3. <Select /> (Unified Native + Custom Liquid Glass Dropdown)
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options?: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onValueChange,
      onChange,
      placeholder = 'Выберите...',
      icon,
      compact = false,
      className = '',
      children,
      disabled,
      name,
      required,
      ...props
    },
    ref
  ) => {
    const { isLight } = useAppTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [internalVal, setInternalVal] = useState(value ?? defaultValue ?? '');
    const containerRef = useRef<HTMLDivElement>(null);
    const closeTimeoutRef = useRef<number | null>(null);

    const currentValue = value !== undefined ? value : internalVal;

    const surfaceClasses = isLight
      ? 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
      : 'bg-slate-900/90 text-slate-100 border-slate-700 hover:border-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25';

    const heightClass = compact ? 'h-9 text-xs' : 'h-11 text-sm';

    const openDropdown = useCallback(() => {
      if (disabled) return;
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setIsOpen(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    }, [disabled]);

    const closeDropdown = useCallback(() => {
      setIsVisible(false);
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = window.setTimeout(() => {
        setIsOpen(false);
      }, 150);
    }, []);

    useEffect(() => {
      if (!isOpen) return;
      const handleOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          closeDropdown();
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeDropdown();
      };
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKey);
      return () => {
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('keydown', handleKey);
      };
    }, [isOpen, closeDropdown]);

    // If `options` prop is provided, render custom Liquid Glass Select with optional hidden input for FormData
    if (options && options.length > 0) {
      const selectedOption = options.find((o) => o.value === String(currentValue));

      const handlePick = (val: string) => {
        if (value === undefined) setInternalVal(val);
        onValueChange?.(val);
        if (onChange) {
          const syntheticEvent = {
            target: { value: val, name: name || '' },
            currentTarget: { value: val, name: name || '' },
          } as React.ChangeEvent<HTMLSelectElement>;
          onChange(syntheticEvent);
        }
        closeDropdown();
      };

      return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
          {name && <input type="hidden" name={name} value={currentValue} required={required} />}
          <button
            type="button"
            disabled={disabled}
            onClick={() => (isOpen ? closeDropdown() : openDropdown())}
            className={`${heightClass} w-full rounded-xl border px-3.5 flex items-center justify-between gap-2 transition-all duration-200 ease-out select-none cursor-pointer disabled:opacity-50 ${surfaceClasses}`}
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              {icon && <span className="text-sky-500 shrink-0">{icon}</span>}
              {selectedOption ? (
                <span className="truncate font-medium">
                  {selectedOption.label}
                  {selectedOption.sublabel ? (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      {selectedOption.sublabel}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="truncate text-slate-400">{placeholder}</span>
              )}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {selectedOption?.badge && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                    isLight
                      ? 'bg-sky-50 text-sky-700 border border-sky-200/80'
                      : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ease-out ${
                  isOpen && isVisible ? 'rotate-180 text-sky-500' : ''
                }`}
              />
            </span>
          </button>

          {isOpen && (
            <div
              className={`absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-2xl p-1.5 backdrop-blur-xl transition-all duration-150 ease-out origin-top ${
                isVisible
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
              } ${
                isLight
                  ? 'bg-white/95 border border-slate-200/90 shadow-[0_16px_40px_rgba(15,23,42,0.14)]'
                  : 'bg-slate-900/95 border border-slate-700/90 shadow-[0_16px_40px_rgba(0,0,0,0.65)]'
              }`}
            >
              {options.map((opt) => {
                const isSelected = String(currentValue) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePick(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-sky-50 text-sky-700 font-semibold'
                          : 'bg-sky-500/20 text-sky-300 font-semibold'
                        : isLight
                        ? 'text-slate-700 hover:bg-slate-100/80'
                        : 'text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="min-w-0 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="ml-1.5 text-xs text-slate-400 font-normal">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                            isSelected
                              ? isLight
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-sky-500/30 text-sky-200'
                              : isLight
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Standard native select with unified appearance
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          name={name}
          disabled={disabled}
          required={required}
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          className={`${heightClass} w-full appearance-none rounded-xl border pl-3.5 pr-9 font-medium transition-all duration-200 ease-out outline-none cursor-pointer disabled:opacity-50 ${surfaceClasses} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
    );
  }
);
Select.displayName = 'Select';

// ============================================================================
// 4. <Card />
// ============================================================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', interactive = false, className = '', children, ...props }, ref) => {
    const { isLight } = useAppTheme();

    const paddingMap = {
      none: '',
      sm: 'p-3 sm:p-4',
      md: 'p-4 sm:p-6',
      lg: 'p-5 sm:p-8',
    };

    const surfaceClasses = isLight
      ? 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
      : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-sm';

    const interactiveClasses = interactive
      ? isLight
        ? 'hover:border-sky-300 hover:shadow-md transition-all duration-200 ease-out cursor-pointer'
        : 'hover:border-sky-500/40 hover:bg-slate-900 transition-all duration-200 ease-out cursor-pointer'
      : 'transition-colors duration-200';

    return (
      <div
        ref={ref}
        className={`rounded-2xl border backdrop-blur-md ${surfaceClasses} ${paddingMap[padding]} ${interactiveClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

// ============================================================================
// 5. <SegmentedControl />
// ============================================================================

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  const { isLight } = useAppTheme();

  const containerSurface = isLight
    ? 'bg-slate-100/90 border border-slate-200/90 text-slate-600'
    : 'bg-slate-900/90 border border-slate-800 text-slate-400';

  const sizeMap = {
    sm: 'p-1 rounded-xl gap-1',
    md: 'p-1 rounded-xl gap-1',
    lg: 'p-1.5 rounded-2xl gap-1.5',
  };

  const buttonSizeMap = {
    sm: 'h-7 px-2.5 text-xs rounded-lg',
    md: 'h-9 px-3.5 text-xs sm:text-sm rounded-lg',
    lg: 'h-10 px-4 text-sm rounded-xl',
  };

  return (
    <div
      role="tablist"
      className={`inline-flex items-center ${
        fullWidth ? 'w-full flex' : 'w-auto'
      } ${containerSurface} ${sizeMap[size]} ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        // Важно: активное состояние меняет только цвета. Жирность шрифта,
        // рамки и паддинги одинаковы — иначе кнопки «прыгают» при переключении.
        const activeClasses = isActive
          ? isLight
            ? 'bg-white text-sky-600 shadow-xs border-slate-200/80'
            : 'bg-sky-600 text-white shadow-xs border-sky-500/40'
          : isLight
          ? 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border-transparent'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent';

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`${
              fullWidth ? 'flex-1 basis-0 min-w-0' : 'shrink-0'
            } ${buttonSizeMap[size]} border font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 ease-out select-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${activeClasses}`}
          >
            {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && opt.badge !== null && (
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold leading-4 shrink-0 ${
                  isActive
                    ? isLight
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-white/20 text-white'
                    : isLight
                    ? 'bg-slate-200/80 text-slate-600'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// 6. <Modal /> & <Sheet /> (Unified Viewport-Centered Portal Modal)
// ============================================================================

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'screen';
  bodyClassName?: string;
  contentClassName?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}

const maxWidthClasses: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  screen: 'max-w-[97vw]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerActions,
  footer,
  maxWidth = 'lg',
  bodyClassName = 'p-4 sm:p-6 overflow-y-auto flex-1 min-h-0',
  contentClassName = '',
  hideHeader = false,
  children,
}: ModalProps) {
  const { isLight } = useAppTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else if (mounted) {
      setVisible(false);
      closeTimerRef.current = window.setTimeout(() => {
        setMounted(false);
      }, 150);
    }
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] w-screen h-[100dvh] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-150 ease-out overflow-hidden ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClasses[maxWidth]} max-h-[92dvh] flex flex-col rounded-2xl border overflow-hidden transition-all duration-150 ease-out ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-1'
        } ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-[0_24px_64px_rgba(15,23,42,0.22)]'
            : 'bg-slate-900 border-slate-800 text-slate-100 shadow-[0_24px_64px_rgba(0,0,0,0.75)]'
        } ${contentClassName}`}
      >
        {!hideHeader && (
          <div
            className={`flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 border-b shrink-0 ${
              isLight
                ? 'bg-slate-50/90 border-slate-200/90'
                : 'bg-slate-900/95 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {icon && (
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isLight
                      ? 'bg-sky-50 border-sky-200/80 text-sky-600'
                      : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                  }`}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <h3
                    className={`text-sm sm:text-base font-bold truncate ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <div
                    className={`text-xs truncate mt-0.5 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть окно"
                title="Закрыть (Esc)"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0 ${
                  isLight
                    ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className={bodyClassName}>{children}</div>

        {footer && (
          <div
            className={`px-4 py-3 sm:px-6 sm:py-4 border-t shrink-0 ${
              isLight ? 'bg-slate-50/80 border-slate-200/90' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export const Sheet = Modal;
