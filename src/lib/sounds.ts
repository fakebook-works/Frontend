type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

let sharedContext: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Constructor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext
  if (!Constructor) return null
  sharedContext ??= new Constructor()
  return sharedContext
}

function withAudioContext(play: (context: AudioContext) => void) {
  const context = audioContext()
  if (!context) return
  if (context.state === 'suspended') {
    void context.resume().then(() => play(context)).catch(() => undefined)
    return
  }
  play(context)
}

export function unlockSoundEffects() {
  const context = audioContext()
  if (context?.state === 'suspended') void context.resume().catch(() => undefined)
}

function tone(
  context: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const start = context.currentTime + startOffset
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function playIncomingMessageSound() {
  withAudioContext((context) => {
    tone(context, 660, 0, 0.12, 0.075, 'sine')
    tone(context, 880, 0.105, 0.16, 0.065, 'sine')
  })
}

export function playLikeSound(level: 1 | 2 | 3, deflating = false) {
  withAudioContext((context) => {
    if (deflating) {
      tone(context, 250, 0, 0.13, 0.045, 'triangle')
      return
    }
    tone(context, 360 + level * 145, 0, 0.09, 0.05, 'triangle')
  })
}
