import JSZip from 'jszip'

export async function exportZIP(files: { name: string; content: string }[]): Promise<Buffer> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.content)
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return buffer
}
