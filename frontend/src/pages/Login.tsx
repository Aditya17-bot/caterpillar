import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OPERATOR_SOURCE, useLoginOperators, type LoginOperator } from '../services/operatorSource'
import Icon from '../components/common/Icon'
import StatusPill from '../components/common/StatusPill'
import { useAppStore } from '../store/useAppStore'
import { operatorFromConvexDoc } from '../services/operatorMapper'

type Mode = 'rfid' | 'face'
type ScanStage = 'idle' | 'scanning' | 'detected' | 'authenticating' | 'authorized' | 'denied'
type FaceStage = 'idle' | 'camera' | 'detecting' | 'verifying' | 'verified'

const STAGE_LABEL: Record<ScanStage, string> = {
  idle: 'WAITING FOR OPERATOR CARD',
  scanning: 'SCANNING...',
  detected: 'CARD DETECTED',
  authenticating: 'AUTHENTICATING OPERATOR...',
  authorized: 'AUTHORIZED',
  denied: 'ACCESS DENIED',
}

const FACE_STAGE_LABEL: Record<FaceStage, string> = {
  idle: 'CAMERA READY',
  camera: 'CAMERA INITIALIZING...',
  detecting: 'FACE DETECTED',
  verifying: 'VERIFYING IDENTITY...',
  verified: 'IDENTITY VERIFIED',
}

export default function Login() {
  const navigate = useNavigate()
  const login = useAppStore((s) => s.login)
  const operators = useLoginOperators()

  const [mode, setMode] = useState<Mode>('rfid')

  const [scanStage, setScanStage] = useState<ScanStage>('idle')
  const [selected, setSelected] = useState<LoginOperator | null>(null)

  const [faceStage, setFaceStage] = useState<FaceStage>('idle')
  const [faceOperator, setFaceOperator] = useState<LoginOperator | null>(null)
  const [faceConfidence, setFaceConfidence] = useState(0)

  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  function scanCard(operator: LoginOperator | null) {
    setSelected(operator)
    setScanStage('scanning')
    after(500, () => setScanStage('detected'))
    after(1100, () => setScanStage('authenticating'))
    after(1900, () => setScanStage(operator ? 'authorized' : 'denied'))
  }

  function startFaceVerification(operator: LoginOperator) {
    setFaceOperator(operator)
    setFaceStage('camera')
    after(600, () => setFaceStage('detecting'))
    after(1400, () => setFaceStage('verifying'))
    after(2300, () => {
      setFaceConfidence(94 + Math.round(Math.random() * 5))
      setFaceStage('verified')
    })
  }

  function enterPlatform(doc: LoginOperator) {
    login(operatorFromConvexDoc(doc))
    navigate('/')
  }

  const rfidBusy = scanStage === 'scanning' || scanStage === 'detected' || scanStage === 'authenticating'
  const faceBusy = faceStage === 'camera' || faceStage === 'detecting' || faceStage === 'verifying'

  return (
    <div className="min-h-screen w-full bg-surface flex items-center justify-center p-space-lg relative overflow-hidden">
      {/* Subtle industrial grid backdrop */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="login-grid" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#ffc174" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary-container" />

      <div className="relative z-10 w-full max-w-3xl flex flex-col gap-space-lg">
        <div className="flex flex-col items-center text-center gap-space-xs">
          <div className="h-12 w-12 rounded bg-primary-container flex items-center justify-center text-on-primary-container font-headline-lg text-2xl font-extrabold shadow-lg">
            C
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight uppercase mt-space-sm">
            CAT Smart Operator Assistant
          </h1>
          <span className="font-label-sm text-label-sm text-on-surface-variant tracking-widest uppercase">
            Operator Access // Industrial Authentication Terminal
          </span>
        </div>

        <div className="bg-surface-container-low rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center bg-surface-container-lowest p-1 m-space-md rounded">
            <button
              onClick={() => setMode('rfid')}
              className={`flex-1 px-space-md py-2.5 rounded font-headline-md text-label-md tracking-wider uppercase font-bold transition-colors flex items-center justify-center gap-2 ${
                mode === 'rfid' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name="contactless" className="text-[18px]" />
              RFID Operator Card
            </button>
            <button
              onClick={() => setMode('face')}
              className={`flex-1 px-space-md py-2.5 rounded font-headline-md text-label-md tracking-wider uppercase font-bold transition-colors flex items-center justify-center gap-2 ${
                mode === 'face' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name="face" className="text-[18px]" />
              Face Verification
            </button>
          </div>

          {mode === 'rfid' ? (
            <div className="p-space-lg pt-space-sm flex flex-col gap-space-lg">
              <div className="flex flex-col items-center gap-space-md py-space-md">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full ${
                      scanStage === 'authorized'
                        ? 'bg-tertiary/10'
                        : scanStage === 'denied'
                          ? 'bg-error/10'
                          : 'bg-primary/10'
                    } ${rfidBusy ? 'animate-pulse' : ''}`}
                  />
                  <div
                    className={`absolute inset-6 rounded-full border-2 ${
                      scanStage === 'authorized'
                        ? 'border-tertiary'
                        : scanStage === 'denied'
                          ? 'border-error'
                          : 'border-primary/60'
                    } ${rfidBusy ? 'animate-ping' : ''}`}
                  />
                  <div className="relative z-10 w-20 h-20 rounded-xl bg-surface-container-high flex items-center justify-center shadow-lg">
                    <Icon
                      name={scanStage === 'authorized' ? 'verified_user' : scanStage === 'denied' ? 'dangerous' : 'contactless'}
                      className={`text-[40px] ${
                        scanStage === 'authorized' ? 'text-tertiary' : scanStage === 'denied' ? 'text-error' : 'text-primary'
                      }`}
                      filled
                    />
                  </div>
                </div>
                <StatusPill
                  label={STAGE_LABEL[scanStage]}
                  token={scanStage === 'authorized' ? 'tertiary' : scanStage === 'denied' ? 'error' : 'primary'}
                  pulse={rfidBusy}
                  size="md"
                />
                <span className="font-body-md text-body-md text-on-surface-variant">Place operator card near scanner</span>
              </div>

              {(scanStage === 'authorized' || scanStage === 'denied') && (
                <div className={`rounded-lg p-space-md flex flex-col gap-space-sm ${scanStage === 'authorized' ? 'bg-tertiary-container/10' : 'bg-error-container/10'}`}>
                  {scanStage === 'authorized' && selected ? (
                    <>
                      <div className="flex items-center gap-space-md">
                        <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-primary">
                          {selected.photoInitials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-headline-md text-headline-md text-on-surface font-bold">{selected.name}</span>
                          <span className="font-body-md text-body-md text-primary font-mono">{selected.operatorId}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-space-sm font-body-md text-[12px]">
                        <div className="bg-surface-container-lowest rounded p-2">
                          <div className="text-outline uppercase text-[10px]">Training</div>
                          <div className={selected.trainingStatus === 'VALID' ? 'text-tertiary font-bold' : 'text-error font-bold'}>
                            {selected.trainingStatus}
                          </div>
                        </div>
                        <div className="bg-surface-container-lowest rounded p-2">
                          <div className="text-outline uppercase text-[10px]">Skill</div>
                          <div className="text-on-surface font-bold">{selected.skill}</div>
                        </div>
                        <div className="bg-surface-container-lowest rounded p-2">
                          <div className="text-outline uppercase text-[10px]">Role</div>
                          <div className="text-on-surface font-bold truncate">{selected.role}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => enterPlatform(selected)}
                        className="mt-space-xs w-full py-3 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-headline-md text-label-md uppercase tracking-wider font-bold rounded shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        Continue to Command Center
                        <Icon name="arrow_forward" className="text-[18px]" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-headline-md text-body-lg text-error font-bold uppercase">Access Denied</span>
                      <span className="font-body-md text-body-md text-on-surface-variant">
                        Reason: Card not recognized by site RFID registry.
                      </span>
                      <button
                        onClick={() => setScanStage('idle')}
                        className="mt-space-xs self-start px-space-md py-2 bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-sm uppercase tracking-wider font-bold rounded transition-all"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-space-sm">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">
                  Demo Operator Badges (simulated — no real hardware)
                </span>
                <div className="grid grid-cols-2 gap-space-sm">
                  {operators === undefined && (
                    <span className="col-span-2 font-body-md text-body-md text-on-surface-variant">Loading operator registry…</span>
                  )}
                  {operators?.map((op) => (
                    <button
                      key={op._id}
                      disabled={rfidBusy}
                      onClick={() => scanCard(op)}
                      className="flex items-center gap-space-sm p-space-sm rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                        {op.photoInitials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-body-md text-body-md text-on-surface font-semibold truncate">{op.name}</span>
                        <span className="font-label-sm text-label-sm text-outline font-mono">{op.operatorId}</span>
                      </div>
                    </button>
                  ))}
                  <button
                    disabled={rfidBusy}
                    onClick={() => scanCard(null)}
                    className="flex items-center gap-space-sm p-space-sm rounded bg-surface-container-lowest hover:bg-surface-container disabled:opacity-50 transition-colors text-left border border-dashed border-outline-variant"
                  >
                    <Icon name="help" className="text-[20px] text-outline shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface-variant">Simulate Unregistered Card</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-space-lg pt-space-sm flex flex-col gap-space-lg">
              <div className="flex flex-col items-center gap-space-md py-space-md">
                <div className="relative w-48 h-36 rounded-lg bg-surface-container-lowest border-2 border-surface-container-high flex items-center justify-center overflow-hidden">
                  <Icon
                    name={faceStage === 'verified' ? 'verified_user' : 'face'}
                    className={`text-[48px] ${faceStage === 'verified' ? 'text-tertiary' : faceBusy ? 'text-primary animate-pulse' : 'text-outline'}`}
                    filled={faceStage === 'verified'}
                  />
                  {faceBusy && <div className="absolute inset-0 border-2 border-primary/50 animate-pulse rounded-lg" />}
                  <span className="absolute top-1.5 left-2 font-label-sm text-[9px] text-on-surface-variant uppercase tracking-wider">
                    CAM-LOGIN-01
                  </span>
                </div>
                <StatusPill
                  label={FACE_STAGE_LABEL[faceStage]}
                  token={faceStage === 'verified' ? 'tertiary' : 'primary'}
                  pulse={faceBusy}
                  size="md"
                />
                <span className="font-body-md text-body-md text-on-surface-variant text-center max-w-sm">
                  Simulated computer-vision verification for this hackathon prototype — no biometric data is captured.
                </span>
              </div>

              {faceStage === 'verified' && faceOperator ? (
                <div className="rounded-lg p-space-md flex flex-col gap-space-sm bg-tertiary-container/10">
                  <div className="flex items-center gap-space-md">
                    <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-primary">
                      {faceOperator.photoInitials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline-md text-headline-md text-on-surface font-bold">{faceOperator.name}</span>
                      <span className="font-body-md text-body-md text-primary font-mono">{faceOperator.operatorId}</span>
                    </div>
                    <span className="ml-auto font-telemetry-md text-telemetry-md text-tertiary font-bold">{faceConfidence}%</span>
                  </div>
                  <button
                    onClick={() => enterPlatform(faceOperator)}
                    className="w-full py-3 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-headline-md text-label-md uppercase tracking-wider font-bold rounded shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    Continue to Command Center
                    <Icon name="arrow_forward" className="text-[18px]" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-space-sm">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">
                    Select demo identity to simulate
                  </span>
                  <div className="grid grid-cols-2 gap-space-sm">
                    {operators
                      ?.filter((o) => o.faceVerificationEnabled)
                      .map((op) => (
                        <button
                          key={op._id}
                          disabled={faceBusy}
                          onClick={() => startFaceVerification(op)}
                          className="flex items-center gap-space-sm p-space-sm rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-50 transition-colors text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                            {op.photoInitials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-body-md text-body-md text-on-surface font-semibold truncate">{op.name}</span>
                            <span className="font-label-sm text-label-sm text-outline font-mono">{op.operatorId}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <span className="text-center font-label-sm text-label-sm text-outline uppercase tracking-widest">
          Simulated authentication for hackathon demonstration — no real RFID or biometric hardware connected. Operator registry: {OPERATOR_SOURCE}.
        </span>
      </div>
    </div>
  )
}
