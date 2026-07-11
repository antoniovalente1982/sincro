// ElevenLabs TTS — stub (modulo rimosso)
// textToSpeech restituisce null, i consumer fanno fallback a testo

export async function textToSpeech(_text: string): Promise<Buffer | null> {
  return null
}

export async function generateSpeech(_text: string): Promise<Buffer | null> {
  return null
}
