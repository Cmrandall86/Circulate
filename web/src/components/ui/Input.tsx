import { InputHTMLAttributes, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  descriptionId?: string
}

export default function Input({
  label,
  descriptionId,
  className = '',
  id,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="text-caption mb-2 block text-ink-500">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-describedby={descriptionId}
        className={`text-body w-full rounded-2xl border border-base-600 bg-base-700 px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-400 ${className}`}
        {...props}
      />
    </div>
  )
}
