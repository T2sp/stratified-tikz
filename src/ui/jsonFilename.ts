export const defaultJsonDownloadFilename = 'stratified-tikz-diagram.json'

export function normalizeJsonDownloadFilename(input: string): string {
  const sanitizedFilename = input.trim().replace(/[\\/]+/g, '-')
  const filename =
    sanitizedFilename.length === 0
      ? defaultJsonDownloadFilename
      : sanitizedFilename

  return filename.toLowerCase().endsWith('.json') ? filename : `${filename}.json`
}
