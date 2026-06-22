export type ClipboardWriter = {
  writeText: (text: string) => Promise<void>
}

export type DownloadAnchor = {
  href: string
  download: string
  click: () => void
  remove: () => void
}

export type TextFileDownloadEnvironment = {
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
  createAnchor: () => DownloadAnchor
  appendAnchor: (anchor: DownloadAnchor) => void
}

export async function copyTextToClipboard(
  text: string,
  clipboard: ClipboardWriter | null = browserClipboardWriter(),
): Promise<boolean> {
  if (clipboard === null) {
    return false
  }

  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function downloadTextFile(
  text: string,
  options: {
    filename: string
    mimeType: string
  },
  environment: TextFileDownloadEnvironment = browserTextFileDownloadEnvironment(),
): boolean {
  let url: string | null = null

  try {
    const blob = new Blob([text], { type: options.mimeType })
    const anchor = environment.createAnchor()

    url = environment.createObjectUrl(blob)
    anchor.href = url
    anchor.download = options.filename
    environment.appendAnchor(anchor)
    anchor.click()
    anchor.remove()
    return true
  } catch {
    return false
  } finally {
    if (url !== null) {
      environment.revokeObjectUrl(url)
    }
  }
}

function browserClipboardWriter(): ClipboardWriter | null {
  return typeof navigator === 'undefined' ? null : navigator.clipboard ?? null
}

function browserTextFileDownloadEnvironment(): TextFileDownloadEnvironment {
  return {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    appendAnchor: (anchor) => {
      if (!(anchor instanceof Node)) {
        throw new Error('Download anchor must be a DOM node.')
      }

      document.body.append(anchor)
    },
  }
}
