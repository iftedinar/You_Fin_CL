import pdfParse from 'pdf-parse'

export async function extractPDF(buffer: Buffer): Promise<{ text: string; title: string }> {
  const data = await pdfParse(buffer)

  const text = data.text?.replace(/\s+/g, ' ').trim() ?? ''

  if (!text || text.length < 100) {
    throw new Error('Could not extract readable text from this PDF')
  }

  // Use first meaningful line as title
  const firstLine = data.text.split('\n').find(l => l.trim().length > 5)?.trim()
  const title = firstLine ?? 'Uploaded PDF'

  return { text, title }
}
