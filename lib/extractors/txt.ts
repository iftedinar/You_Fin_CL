export async function extractTXT(buffer: Buffer, filename: string): Promise<{ text: string; title: string }> {
  const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim()

  if (!text || text.length < 50) {
    throw new Error('File is empty or too short to extract knowledge from')
  }

  // Use the first non-empty line as title, fall back to filename
  const firstLine = text.split('\n').find(l => l.replace(/^#+\s*/, '').trim().length > 3)
  const titleFromContent = firstLine?.replace(/^#+\s*/, '').trim()
  const titleFromFile = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  const title = titleFromContent ?? titleFromFile ?? 'Uploaded text'

  return { text, title }
}
