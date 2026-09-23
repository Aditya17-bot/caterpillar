import type { ScenarioEffect, ScenarioKey } from '../types/domain'

// This module is the frontend "simulation engine" for the hackathon demo.
// Each scenario returns a deterministic bundle of telemetry, an AI speed
// recommendation with explainability, a copilot message, an optional alert,
// optional safety-checklist overrides, and an optional incident record.
//
// This is mock/demo logic only. In production this shape is exactly what a
// real Smart Speed / Fault Detection / Drowsiness API would return, so pages
// consuming `getScenarioEffect()` do not need to change when swapped for
// real inference calls.

const baseDrowsiness = {
  state: 'alert' as const,
  confidencePct: 97.8,
  earValue: 0.32,
  blinkRatePerMin: 16,
  headPitchDeg: 1.2,
}

export function getScenarioEffect(key: ScenarioKey, machineId: string): ScenarioEffect {
  switch (key) {
    case 'normal':
      return {
        key,
        telemetry: { engineTempC: 88, vibrationG: 0.45, slopeDeg: 3.1, loadPct: 62, speedKmh: 14, recommendedSpeedKmh: 15 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 14,
          recommendedSpeedKmh: 15,
          reason: 'Machine traveling on stable compact haul road within full safety envelope.',
          confidencePct: 98.1,
          factors: [
            { label: 'Slope Gradient', weightPct: 20, colorToken: 'primary' },
            { label: 'Track Vibration', weightPct: 15, colorToken: 'tertiary' },
            { label: 'Bucket Payload', weightPct: 10, colorToken: 'secondary' },
          ],
          slopeDeg: 3.1,
          loadPct: 62,
          vibrationG: 0.45,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Site clear. All parameters nominal. You are clear for unrestricted 360-degree slew operations.',
      }
    case 'heavy_load':
      return {
        key,
        telemetry: { loadPct: 96, hydraulicPressureBar: 348, speedKmh: 18, recommendedSpeedKmh: 12 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 18,
          recommendedSpeedKmh: 12,
          reason: 'Bucket payload at 96% capacity increases stopping distance and tip-over risk at current speed.',
          confidencePct: 95.6,
          factors: [
            { label: 'Bucket Mass (96% capacity)', weightPct: 55, colorToken: 'secondary' },
            { label: 'Hydraulic Pressure', weightPct: 25, colorToken: 'primary' },
            { label: 'Slope Gradient', weightPct: 20, colorToken: 'tertiary' },
          ],
          slopeDeg: 4,
          loadPct: 96,
          vibrationG: 0.9,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Heavy payload detected at 96% bucket capacity. Reducing max travel speed to preserve stability margin.',
        alert: {
          severity: 'warning',
          category: 'overspeed',
          title: 'Heavy Payload — Speed Advisory',
          message: 'Bucket payload at 96% capacity. Recommended max speed reduced to 12 km/h.',
        },
      }
    case 'steep_slope':
      return {
        key,
        telemetry: { slopeDeg: 14.2, loadPct: 78, vibrationG: 1.1, speedKmh: 22, recommendedSpeedKmh: 15 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 22,
          recommendedSpeedKmh: 15,
          reason: 'Combined uphill grade, heavy payload, and elevated vibration exceed dynamic stability margins.',
          confidencePct: 98.4,
          factors: [
            { label: 'Slope Gradient (+14.2° uphill)', weightPct: 42, colorToken: 'primary' },
            { label: 'Triaxial Track Vibration', weightPct: 38, colorToken: 'error' },
            { label: 'Bucket Mass (78% / 1.95m³)', weightPct: 20, colorToken: 'secondary' },
          ],
          slopeDeg: 14.2,
          loadPct: 78,
          vibrationG: 1.82,
          surface: 'Uncompacted Shale',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Incline warning: terrain angle is +14.2 degrees. Lower boom close to ground to balance center of mass and maintain traction.',
        alert: {
          severity: 'warning',
          category: 'slope',
          title: 'Steep Slope Warning',
          message: 'Terrain grade reached +14.2° (max spec 15.0°). AI reduced target speed to 15 km/h.',
        },
        safetyOverrides: { speed_slope: { state: 'warning', value: 'NEAR LIMIT' } },
      }
    case 'high_vibration':
      return {
        key,
        telemetry: { vibrationG: 2.42, speedKmh: 19, recommendedSpeedKmh: 11 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 19,
          recommendedSpeedKmh: 11,
          reason: 'Chassis vibration exceeds continuous operating limit — undercarriage wear risk on rock outcrop.',
          confidencePct: 96.9,
          factors: [
            { label: 'Triaxial Vibration (2.42G)', weightPct: 60, colorToken: 'error' },
            { label: 'Surface Roughness', weightPct: 25, colorToken: 'primary' },
            { label: 'Track Slippage', weightPct: 15, colorToken: 'secondary' },
          ],
          slopeDeg: 5,
          loadPct: 70,
          vibrationG: 2.42,
          surface: 'Fragmented Limestone',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Severe track chatter detected on rock outcrop. Suggest veering 5 degrees left into crushed aggregate path to avoid undercarriage shock.',
        alert: {
          severity: 'warning',
          category: 'vibration',
          title: 'Excessive Chassis Vibration',
          message: '2.42 G RMS exceeds continuous limit. Undercarriage wear risk elevated.',
        },
      }
    case 'proximity_hazard':
      return {
        key,
        telemetry: { speedKmh: 22, recommendedSpeedKmh: 15 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 22,
          recommendedSpeedKmh: 15,
          reason: 'Unregistered vehicle detected in blind swing quadrant at 2.4 meters.',
          confidencePct: 99.4,
          factors: [
            { label: 'Obstacle Proximity (2.4m)', weightPct: 70, colorToken: 'error' },
            { label: 'Swing Trajectory', weightPct: 20, colorToken: 'primary' },
            { label: 'Approach Speed', weightPct: 10, colorToken: 'secondary' },
          ],
          slopeDeg: 4,
          loadPct: 74,
          vibrationG: 0.9,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Attention: rock haul truck has encroached into your blind swing quadrant at 2.4 meters. Automatic slew limiter active. Hold bucket elevation until vehicle clears the red zone.',
        alert: {
          severity: 'critical',
          category: 'proximity',
          title: 'Critical Obstacle Proximity',
          message: 'Unregistered vehicle detected at 2.4 meters in blind corridor. Collision severity 1.',
        },
        createsIncident: {
          category: 'proximity',
          severity: 'critical',
          description: 'Haul truck breached 2.4m rear blind quadrant during active swing cycle.',
          sensorEvidence: 'mmWave Radar #04 + LiDAR Cam 01',
          actionTaken: 'Automatic slew limiter engaged, audible cab alert triggered.',
        },
      }
    case 'seatbelt_violation':
      return {
        key,
        telemetry: {},
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 0,
          recommendedSpeedKmh: 0,
          reason: 'Seatbelt sensor disengaged. Hydraulic joystick interlock automatically locked.',
          confidencePct: 100,
          factors: [{ label: 'Seatbelt Interlock', weightPct: 100, colorToken: 'error' }],
          slopeDeg: 4,
          loadPct: 74,
          vibrationG: 0.82,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Seatbelt unlatched. Machine motion has been inhibited by safety interlock. Fasten restraint to restore hydraulic joystick response.',
        alert: {
          severity: 'critical',
          category: 'seatbelt',
          title: 'Seatbelt Sensor Disengaged',
          message: 'Pilot hydraulics auto-locked. Mandatory lockout in effect.',
        },
        safetyOverrides: { seatbelt: { state: 'fail', value: 'UNFASTENED' } },
        createsIncident: {
          category: 'seatbelt',
          severity: 'critical',
          description: 'Seatbelt disengaged during active operation cycle.',
          sensorEvidence: 'Latching Hall-Sensor',
          actionTaken: 'Hydraulic joystick interlock automatically locked.',
        },
      }
    case 'drowsiness':
      return {
        key,
        telemetry: {},
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 14,
          recommendedSpeedKmh: 8,
          reason: 'Operator microsleep pattern detected — precautionary speed reduction until acknowledgement.',
          confidencePct: 94.2,
          factors: [{ label: 'Eye Closure Duration', weightPct: 100, colorToken: 'error' }],
          slopeDeg: 4,
          loadPct: 74,
          vibrationG: 0.82,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: { state: 'drowsy', confidencePct: 91.2, earValue: 0.14, blinkRatePerMin: 38, headPitchDeg: -18.4 },
        copilotMessage: 'Sarah, camera detected sustained blink duration over 2.1 seconds. Cab alert audio triggered. Site supervisor alerted. Please park in a safe pocket if fatigued.',
        alert: {
          severity: 'critical',
          category: 'drowsiness',
          title: 'Cognitive Alert — Microsleep Risk',
          message: 'Operator eye closure detected (PERCLOS 48%). Fatigue level 3.',
        },
        safetyOverrides: { fatigue: { state: 'fail', value: 'DROWSY' } },
        createsIncident: {
          category: 'drowsiness',
          severity: 'critical',
          description: 'EAR dropped to 0.14 for over 2.1 seconds during active operation.',
          sensorEvidence: 'Cab-Cam IR AI Mesh',
          actionTaken: 'Haptic seat pulse + audible alert triggered, supervisor notified.',
        },
      }
    case 'engine_overheating':
      return {
        key,
        telemetry: { engineTempC: 106, rpm: 1100 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 10,
          recommendedSpeedKmh: 5,
          reason: 'Coolant temperature critical — thermal derate active to protect powertrain.',
          confidencePct: 99.1,
          factors: [{ label: 'Coolant Temperature', weightPct: 100, colorToken: 'error' }],
          slopeDeg: 4,
          loadPct: 74,
          vibrationG: 0.82,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Engine temperature critical. Cooling fan auto-shifted to 100% duty cycle. Hydraulic pump displacement reduced. Idle engine to prevent head gasket damage.',
        alert: {
          severity: 'critical',
          category: 'overheat',
          title: 'Critical Engine Overheat',
          message: 'Coolant at 106°C exceeds safety redline. Thermal derate at 50%.',
        },
        safetyOverrides: { oil: { state: 'fail', value: '106°C CRITICAL' }, coolant: { state: 'fail', value: '106°C CRITICAL' } },
        createsIncident: {
          category: 'engine',
          severity: 'critical',
          description: 'Coolant temperature reached 106°C, exceeding safety redline.',
          sensorEvidence: 'ECM Coolant Sensor',
          actionTaken: 'Automatic thermal derate + cooling fan 100% duty engaged.',
        },
      }
    case 'low_oil_pressure':
      return {
        key,
        telemetry: { oilPressurePsi: 15.9 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 0,
          recommendedSpeedKmh: 0,
          reason: 'Catastrophic oil pressure loss detected. Engine protection shutdown imminent.',
          confidencePct: 99.8,
          factors: [{ label: 'Oil Pressure Collapse', weightPct: 100, colorToken: 'error' }],
          slopeDeg: 4,
          loadPct: 74,
          vibrationG: 0.82,
          surface: 'Dry Compacted Clay',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Emergency: catastrophic oil pressure loss detected. Automatic engine protection shutdown countdown initialized. Lower arm immediately.',
        alert: {
          severity: 'critical',
          category: 'oil_pressure',
          title: 'Engine Oil Pressure Drop',
          message: '15.9 PSI reading (minimum 45 PSI). Emergency shutdown in 30s.',
        },
        safetyOverrides: { oil: { state: 'fail', value: '15.9 PSI CRITICAL' } },
        createsIncident: {
          category: 'engine',
          severity: 'critical',
          description: 'Oil pressure collapsed to 15.9 PSI during active operation.',
          sensorEvidence: 'ECM Oil Pressure Sensor',
          actionTaken: 'Automatic engine protection shutdown sequence initiated.',
        },
      }
    case 'excessive_idling':
      return {
        key,
        telemetry: { idleMin: 11.4, speedKmh: 0, rpm: 650 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 0,
          recommendedSpeedKmh: 0,
          reason: 'Idle time exceeds efficiency target — unnecessary fuel burn detected.',
          confidencePct: 92.0,
          factors: [{ label: 'Idle Duration', weightPct: 100, colorToken: 'primary' }],
          slopeDeg: 0,
          loadPct: 0,
          vibrationG: 0.1,
          surface: 'Parked',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Idle duration has exceeded the 10-minute efficiency target. Estimated 3.8L of fuel wasted this cycle. Consider shutting down if delay continues.',
        alert: {
          severity: 'warning',
          category: 'idle',
          title: 'Excessive Idling Detected',
          message: 'Idle time 11.4 min vs 4.2 min normal. Potential fuel waste 3.8L.',
        },
      }
    case 'unsafe_operation':
      return {
        key,
        telemetry: { slopeDeg: 16.4, vibrationG: 2.1, loadPct: 92, speedKmh: 24, recommendedSpeedKmh: 10 },
        speedRecommendation: {
          machineId,
          currentSpeedKmh: 24,
          recommendedSpeedKmh: 10,
          reason: 'Multiple safety envelopes breached simultaneously — slope, vibration, and payload all critical.',
          confidencePct: 99.6,
          factors: [
            { label: 'Slope Gradient (+16.4°)', weightPct: 38, colorToken: 'primary' },
            { label: 'Triaxial Vibration (2.1G)', weightPct: 34, colorToken: 'error' },
            { label: 'Bucket Mass (92%)', weightPct: 28, colorToken: 'secondary' },
          ],
          slopeDeg: 16.4,
          loadPct: 92,
          vibrationG: 2.1,
          surface: 'Loose Shale',
        },
        drowsiness: baseDrowsiness,
        copilotMessage: 'Multiple safety thresholds breached simultaneously. Immediate speed reduction enforced. Recommend halting operation and requesting supervisor review.',
        alert: {
          severity: 'critical',
          category: 'overspeed',
          title: 'Unsafe Operation — Multi-Factor Critical',
          message: 'Slope, vibration and payload all exceed safe thresholds concurrently.',
        },
        safetyOverrides: { speed_slope: { state: 'fail', value: 'BREACHED' } },
        createsIncident: {
          category: 'unsafe_operation',
          severity: 'critical',
          description: 'Concurrent slope, vibration and payload threshold breach during active haul.',
          sensorEvidence: 'IMU + Triaxial Accelerometer + Load Cell',
          actionTaken: 'AI enforced emergency speed derate to 10 km/h.',
        },
      }
  }
}
