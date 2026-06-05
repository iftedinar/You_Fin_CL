import mammoth from 'mammoth'

export async function extractDOCX(buffer: Buffer): Promise<{ text: string; title: string }> {
  const result = await mammoth.extractRawText({ buffer })

  const text = result.value?.replace(/\s+/g, ' ').trim() ?? ''

  if (!text || text.length < 50) {
    throw new Error('Could not extract readable text from this Word document')
  }

  // Use the first meaningful line as a title
  const firstLine = result.value.split('\n').find(l => l.trim().length > 5)?.trim()
  const title = firstLine ?? 'Uploaded Document'

  return { text, title }
}
