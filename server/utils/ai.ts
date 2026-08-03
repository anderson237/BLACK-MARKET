import { GoogleGenAI } from '@google/genai'

let ai: GoogleGenAI | null | undefined
export function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  if (ai === undefined) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })
  }
  return ai
}

export const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
export const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite'

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: { model: string; contents: any; config?: any },
  fallbackModel: string,
  retries = 3,
  delayMs = 1500,
): Promise<any> {
  let lastError: any = null
  const modelsToTry = [params.model, fallbackModel]

  for (const model of modelsToTry) {
    let currentDelay = delayMs
    const attemptParams = { ...params, model }
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await ai.models.generateContent(attemptParams)
      } catch (error: any) {
        lastError = error
        const errorString = JSON.stringify(error) + ' ' + (error.message || '')
        const isTemporary =
          errorString.includes('503') ||
          errorString.includes('UNAVAILABLE') ||
          errorString.includes('demand') ||
          error.status === 503
        if (isTemporary && attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, currentDelay))
          currentDelay *= 2
          continue
        }
        break
      }
    }
  }
  throw lastError || new Error('Failed to generate content after trying multiple models and retries.')
}