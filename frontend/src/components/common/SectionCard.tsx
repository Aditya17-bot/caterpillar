import type { ReactNode } from 'react'

interface SectionCardProps {
  children: ReactNode
  className?: string
  variant?: 'low' | 'default' | 'lowest'
  padding?: 'sm' | 'md' | 'lg'
}

const surfaceByVariant = {
  low: 'bg-surface-container-low',
  default: 'bg-surface-container',
  lowest: 'bg-surface-container-lowest',
}

const paddingBySize = {
  sm: 'p-space-sm',
  md: 'p-space-md',
  lg: 'p-space-lg',
}

export default function SectionCard({ children, className = '', variant = 'low', padding = 'lg' }: SectionCardProps) {
  return (
    <div className={`${surfaceByVariant[variant]} ${paddingBySize[padding]} rounded-xl shadow-md ${className}`}>
      {children}
    </div>
  )
}
