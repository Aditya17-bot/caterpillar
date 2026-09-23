import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/common/Icon'
import SectionCard from '../components/common/SectionCard'
import StatusPill from '../components/common/StatusPill'
import MachineCard from '../components/domain/MachineCard'
import AIInsightPanel from '../components/domain/AIInsightPanel'
import SafetyChecklistItem from '../components/domain/SafetyChecklistItem'
import { useAppStore } from '../store/useAppStore'
import { machineStatusToToken } from '../lib/statusColors'
import { getTaskTimePrediction } from '../services/predictionService'

export default function ScheduleTasks() {
  const navigate = useNavigate()
  const tasks = useAppStore((s) => s.tasks)
  const machines = useAppStore((s) => s.machines)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectedMachineId = useAppStore((s) => s.selectedMachineId)
  const selectTask = useAppStore((s) => s.selectTask)
  const selectMachine = useAppStore((s) => s.selectMachine)
  const [filter, setFilter] = useState<'all' | 'available'>('all')
  const interlockSensors = useAppStore((s) => s.interlockSensors)
  const operators = useAppStore((s) => s.operators)
  const backendOnline = useAppStore((s) => s.backendOnline)

  const activeTask = tasks.find((t) => t.id === selectedTaskId) ?? tasks[0]
  const selectedMachine = machines.find((m) => m.id === selectedMachineId) ?? machines[0]
  const prediction = getTaskTimePrediction(activeTask)
  const assignedOp = operators.find((o) => o.id === activeTask.assignedOperatorId)
  const factorText = (activeTask.factors || [])
    .slice(0, 3)
    .map((f) => `${f.label} ${f.deltaMin > 0 ? '+' : ''}${f.deltaMin} min`)
    .join(', ')
  const visibleMachines = filter === 'available' ? machines.filter((m) => m.status === 'available') : machines

  return (
    <div className="p-margin lg:p-margin-lg flex flex-col gap-space-lg">
      <SectionCard variant="low" className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md">
        <div className="flex flex-wrap items-center gap-space-md">
          <div className="flex items-center bg-surface-container-lowest p-1 rounded">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTask(t.id)}
                className={`px-space-md py-1.5 rounded font-headline-md text-label-sm tracking-wider uppercase transition-colors ${
                  t.id === activeTask.id ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.id}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            onClick={() => setFilter('all')}
            className={`px-space-md py-1 rounded font-headline-md text-label-sm uppercase font-bold ${filter === 'all' ? 'bg-surface-bright text-on-surface' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            All Equipment ({machines.length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`px-space-md py-1 rounded font-headline-md text-label-sm uppercase font-bold ${filter === 'available' ? 'bg-tertiary-container/30 text-tertiary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            Available Only ({machines.filter((m) => m.status === 'available').length})
          </button>
        </div>
      </SectionCard>

      <SectionCard variant="default" className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
        <div className="flex flex-wrap items-center gap-space-md">
          <div className="flex items-center gap-2 px-space-md py-1 bg-surface-container-high rounded text-primary">
            <Icon name="account_tree" className="text-[16px]" />
            <span className="font-headline-md text-label-md uppercase tracking-wider font-bold">Target: {activeTask.title}</span>
          </div>
          <div className="flex items-center gap-space-md text-on-surface-variant font-body-md text-body-md">
            <span className="flex items-center gap-1.5">
              <Icon name="cloud_upload" className="text-[16px] text-outline" />
              Vol: <strong className="text-on-surface font-telemetry-md">{activeTask.volumeM3} m³</strong>
            </span>
            <span className="h-3 w-px bg-surface-variant" />
            <span className="flex items-center gap-1.5">
              <Icon name="layers" className="text-[16px] text-outline" />
              Soil: <strong className="text-on-surface font-body-lg">{activeTask.soilType}</strong>
            </span>
            <span className="h-3 w-px bg-surface-variant" />
            <span className="flex items-center gap-1.5">
              <Icon name="explore" className="text-[16px] text-secondary" />
              Location: <strong className="text-secondary font-body-lg">{activeTask.location}</strong>
            </span>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          {visibleMachines.map((m) => (
            <MachineCard key={m.id} machine={m} selected={m.id === selectedMachine.id} onSelect={selectMachine} />
          ))}
        </div>

        <div className="xl:col-span-5 flex flex-col gap-space-md">
          <SectionCard variant="low" className="flex flex-col gap-space-md shadow-xl">
            <div className="flex items-center justify-between pb-space-sm bg-surface-container-lowest p-space-sm rounded">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
                <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">Dispatch Pre-Flight Dossier</span>
              </div>
              <span className="font-body-md text-[11px] text-outline font-telemetry-md">TASK ID: #{activeTask.id}</span>
            </div>

            <div className="flex items-center gap-space-md bg-surface-container p-space-sm rounded">
              <div className="w-16 h-16 rounded bg-surface-container-highest flex-shrink-0 flex items-center justify-center text-primary">
                <Icon name="forklift" className="text-[36px]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-headline-md text-headline-md text-on-surface font-bold truncate">
                  {selectedMachine.model} ({selectedMachine.id})
                </span>
                <StatusPill label={selectedMachine.status.replace('_', ' ')} token={machineStatusToToken[selectedMachine.status]} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-space-sm bg-surface-container-lowest p-space-sm rounded">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Assigned Operator</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Icon name="badge" className="text-[16px] text-primary" />
                  <span className="font-body-lg text-body-lg text-on-surface font-bold">{assignedOp?.name ?? 'Sarah J.'}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Weather &amp; Ground</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Icon name="wb_sunny" className="text-[16px] text-primary-container" />
                  <span className="font-body-lg text-body-lg text-on-surface font-bold">
                    {activeTask.tempC != null ? `${Math.round(activeTask.tempC)}°C ${activeTask.weather ?? ''}` : '31°C Clear'}
                  </span>
                </div>
              </div>
            </div>

            <AIInsightPanel
              title="AI Task Formulation & Simulation"
              modelBadge={backendOnline ? 'RANDOM FOREST · R² 0.89' : 'RF MODEL v9.2'}
              reason={
                backendOnline && activeTask.predictedMin != null
                  ? `Estimate ${prediction.aiEstimateMin} min (80% range ${Math.round(activeTask.predictedLow ?? 0)}–${Math.round(activeTask.predictedHigh ?? 0)}) vs ${prediction.historicalAverageMin} min in typical conditions. Biggest factors: ${factorText || 'none significant'}.`
                  : `Dry soil and operator skill advantage reduce estimated duration below the ${prediction.historicalAverageMin}min handbook baseline.`
              }
              metrics={[
                { label: 'AI Predicted', value: `${prediction.aiEstimateMin} min`, token: 'tertiary' },
                { label: 'Typical', value: `${prediction.historicalAverageMin} min` },
                {
                  label: 'Risk Score',
                  value: activeTask.slopeDeg > 10 || activeTask.soilType === 'Rock' ? 'MEDIUM' : 'LOW',
                  token: activeTask.slopeDeg > 10 || activeTask.soilType === 'Rock' ? 'primary' : 'tertiary',
                },
              ]}
            />

            <div className="flex flex-col gap-space-xs bg-surface-container-lowest p-space-sm rounded">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Safety Verification</span>
                <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary-container font-label-sm text-label-sm font-bold uppercase">
                  {interlockSensors.filter((s) => s.state === 'pass').length} of {interlockSensors.length} Verified
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {interlockSensors.slice(0, 4).map((s) => (
                  <SafetyChecklistItem key={s.id} item={s} compact />
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/operation/preop')}
              className="w-full py-3 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-headline-md text-label-md uppercase tracking-wider font-bold rounded shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Icon name="assignment_turned_in" className="text-[20px]" />
              Confirm &amp; Schedule Dispatch
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
