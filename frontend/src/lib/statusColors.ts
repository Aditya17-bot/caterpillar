import type { MachineStatus, Severity, SafetyState } from '../types/domain'

export type ColorToken = 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral'

export const severityToToken: Record<Severity, ColorToken> = {
  info: 'secondary',
  warning: 'primary',
  critical: 'error',
}

export const safetyStateToToken: Record<SafetyState, ColorToken> = {
  pass: 'tertiary',
  warning: 'primary',
  fail: 'error',
}

export const machineStatusToToken: Record<MachineStatus, ColorToken> = {
  available: 'tertiary',
  reserved: 'secondary',
  in_use: 'primary',
  maintenance: 'error',
  offline: 'neutral',
  warning: 'primary',
  critical: 'error',
}

export const machineStatusLabel: Record<MachineStatus, string> = {
  available: 'Available - Ready',
  reserved: 'Reserved',
  in_use: 'In Active Operation',
  maintenance: 'In Maintenance',
  offline: 'Offline / Comms Lost',
  warning: 'Advisory',
  critical: 'Critical Lockout',
}

// Tailwind class bundles per token — pill / text / dot variants.
export const tokenClasses: Record<ColorToken, { bg: string; text: string; dot: string; border: string }> = {
  primary: { bg: 'bg-primary-container', text: 'text-on-primary-container', dot: 'bg-primary', border: 'border-primary' },
  secondary: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary', border: 'border-secondary' },
  tertiary: { bg: 'bg-tertiary-container/30', text: 'text-tertiary', dot: 'bg-tertiary', border: 'border-tertiary' },
  error: { bg: 'bg-error-container', text: 'text-error', dot: 'bg-error', border: 'border-error' },
  neutral: { bg: 'bg-surface-variant', text: 'text-outline', dot: 'bg-outline', border: 'border-outline' },
}

export const tokenTextClass: Record<ColorToken, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error',
  neutral: 'text-on-surface-variant',
}

export const tokenBarClass: Record<ColorToken, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
  neutral: 'bg-outline',
}
