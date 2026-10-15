import { useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import './App.css'

type PdfItem = {
  id: string
  file: File
  pages: number
}

type PageItem = {
  id: string
  sourceId: string
  pageIndex: number
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<PdfItem[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const addFiles = async (files: FileList | File[]) => {
    setError('')
    setNotice('')
    const selectedFiles = Array.from(files)

    if (selectedFiles.length === 0) return

    const accepted: PdfItem[] = []
    const rejected: string[] = []

    for (const file of selectedFiles) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        rejected.push(`${file.name}: not a PDF`)
        continue
      }

      try {
        const document = await PDFDocument.load(await file.arrayBuffer())
        const pageCount = document.getPageCount()
        if (pageCount === 0) {
          rejected.push(`${file.name}: this PDF doesn't contain any pages`)
          continue
        }
        accepted.push({
          id: crypto.randomUUID(),
          file,
          pages: pageCount,
        })
      } catch {
        rejected.push(`${file.name}: couldn't read this PDF. It may be damaged or password-protected.`)
      }
    }

    if (accepted.length > 0) {
      setItems((current) => [...current, ...accepted])
      setPages((current) => [
        ...current,
        ...accepted.flatMap((item) =>
          Array.from({ length: item.pages }, (_, pageIndex) => ({
            id: crypto.randomUUID(),
            sourceId: item.id,
            pageIndex,
          })),
        ),
      ])
      setNotice(`${accepted.length} PDF${accepted.length === 1 ? '' : 's'} added.`)
    }
    if (rejected.length > 0) {
      setError(rejected.join(' '))
    }
  }

  const movePage = (index: number, offset: number) => {
    const destination = index + offset
    if (destination < 0 || destination >= pages.length) return

    setPages((current) => {
      const reordered = [...current]
      const [page] = reordered.splice(index, 1)
      reordered.splice(destination, 0, page)
      return reordered
    })
    setNotice('Page order updated.')
  }

  const dropPage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= pages.length) return
    setPages((current) => {
      const reordered = [...current]
      const [page] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, page)
      return reordered
    })
    setNotice('Page order updated.')
  }

  const removePdf = (item: PdfItem) => {
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
    setPages((current) => current.filter((page) => page.sourceId !== item.id))
    setNotice(`${item.file.name} and its pages removed.`)
  }

  const mergePdfs = async () => {
    if (pages.length < 2) return

    setIsMerging(true)
    setError('')
    setNotice('')

    try {
      const merged = await PDFDocument.create()
      const sources = new Map<string, PDFDocument>()

      for (const page of pages) {
        let source = sources.get(page.sourceId)
        if (!source) {
          const item = items.find((candidate) => candidate.id === page.sourceId)
          if (!item) throw new Error('A source PDF for one of these pages is missing.')
          source = await PDFDocument.load(await item.file.arrayBuffer())
          sources.set(page.sourceId, source)
        }

        const [copiedPage] = await merged.copyPages(source, [page.pageIndex])
        merged.addPage(copiedPage)
      }

      const bytes = await merged.save()
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'merged-document.pdf'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Your PDF is ready and downloading now.')
    } catch (mergeError) {
      setError(
        mergeError instanceof Error
          ? `Couldn't create the PDF: ${mergeError.message}`
          : 'Something went wrong while creating the PDF.',
      )
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="PDF Studio home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6.5 3.75h7l4 4v12.5h-11V3.75Z" />
              <path d="M13.5 3.75v4h4M9.5 12h5M9.5 15.5h5" />
            </svg>
          </span>
          <span>paper<span className="brand-accent">plane</span></span>
        </a>
        <div className="privacy-pill">
          <span className="privacy-dot" />
          Your files stay on your device
        </div>
      </header>

      <section className="workspace" aria-labelledby="page-title">
        <div className="intro">
          <div className="eyebrow"><span /> SIMPLE, PRIVATE PDF TOOLS</div>
          <h1 id="page-title">Bring your PDFs<br />together.</h1>
          <p className="intro-copy">
            Combine documents and put every page in the order you want. No uploads, no fuss.
          </p>
        </div>

        <div className="editor">
          <div className="editor-heading">
            <div>
              <h2>Add PDFs</h2>
              <p>Add your files, then arrange individual pages below.</p>
            </div>
            {items.length > 0 && (
              <span className="file-count">{items.length} {items.length === 1 ? 'file' : 'files'}</span>
            )}
          </div>

          <div
            className={`dropzone${isDragging ? ' dropzone-active' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              void addFiles(event.dataTransfer.files)
            }}
          >
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files)
                event.target.value = ''
              }}
              aria-label="Choose PDF files"
            />
            <div className="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4h14v-4" />
              </svg>
            </div>
            <div className="dropzone-text">
              <strong>Drop your PDFs here</strong>
              <span>or <button className="text-button" onClick={() => fileInput.current?.click()}>browse files</button> from your device</span>
            </div>
            <span className="file-type">PDF files only</span>
          </div>

          {error && <div className="message message-error" role="alert">{error}</div>}
          {notice && <div className="visually-hidden" role="status" aria-live="polite">{notice}</div>}

          {items.length > 0 && (
            <section className="source-section" aria-labelledby="source-heading">
              <div className="list-heading">
                <h3 id="source-heading">Your files</h3>
                <span>{items.length} {items.length === 1 ? 'PDF' : 'PDFs'}</span>
              </div>
              <ul className="source-list">
                {items.map((item) => (
                  <li className="source-row" key={item.id}>
                    <span className="pdf-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M6.5 3.75h7l4 4v12.5h-11V3.75Z" />
                        <path d="M13.5 3.75v4h4M9 13.25h6M9 16h4" />
                      </svg>
                    </span>
                    <span className="file-details">
                      <span className="file-name" title={item.file.name}>{item.file.name}</span>
                      <span className="file-meta">{item.pages} {item.pages === 1 ? 'page' : 'pages'} <span>·</span> {formatSize(item.file.size)}</span>
                    </span>
                    <button
                      className="icon-button remove-button"
                      type="button"
                      aria-label={`Remove ${item.file.name}`}
                      title="Remove PDF"
                      onClick={() => removePdf(item)}
                    >
                      <svg viewBox="0 0 20 20" fill="none"><path d="m6 6 8 8m0-8-8 8" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pages.length > 0 ? (
            <section className="page-section" aria-labelledby="page-order-heading">
              <div className="list-heading page-list-heading">
                <div>
                  <h3 id="page-order-heading">Arrange pages</h3>
                  <p>Drag pages or use the arrows. This is the order in your finished PDF.</p>
                </div>
                <span>{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
              </div>
              <ol className="page-list" aria-label="Final PDF page order">
                {pages.map((page, index) => {
                  const sourceItem = items.find((item) => item.id === page.sourceId)
                  if (!sourceItem) return null

                  return (
                    <li
                      className="page-row"
                      key={page.id}
                      draggable
                      aria-label={`Position ${index + 1}, ${sourceItem.file.name}, source page ${page.pageIndex + 1}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', String(index))
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (!event.dataTransfer.types.includes('text/plain')) return
                        const fromIndex = Number(event.dataTransfer.getData('text/plain'))
                        if (Number.isInteger(fromIndex)) dropPage(fromIndex, index)
                      }}
                    >
                      <span className="order-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="page-preview" aria-hidden="true">
                        <svg viewBox="0 0 24 28" fill="none">
                          <path d="M4.5 1.75h10l5 5v19.5h-15V1.75Z" />
                          <path d="M14.5 1.75v5h5M8 13h8M8 16.5h8M8 20h5" />
                        </svg>
                        <span>{page.pageIndex + 1}</span>
                      </span>
                      <span className="file-details">
                        <span className="file-name">Page {page.pageIndex + 1}</span>
                        <span className="file-meta" title={sourceItem.file.name}>{sourceItem.file.name}</span>
                      </span>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Move page ${page.pageIndex + 1} from ${sourceItem.file.name} up`}
                          title="Move up"
                          disabled={index === 0}
                          onClick={() => movePage(index, -1)}
                        >
                          <svg viewBox="0 0 20 20" fill="none"><path d="m5 12 5-5 5 5" /></svg>
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Move page ${page.pageIndex + 1} from ${sourceItem.file.name} down`}
                          title="Move down"
                          disabled={index === pages.length - 1}
                          onClick={() => movePage(index, 1)}
                        >
                          <svg viewBox="0 0 20 20" fill="none"><path d="m5 8 5 5 5-5" /></svg>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : (
            <div className="empty-state">
              <span className="empty-lines" aria-hidden="true"><i /><i /><i /></span>
              <span>Your pages will show up here</span>
            </div>
          )}

          <div className="editor-footer">
            <div className="summary">
              {pages.length > 0 ? (
                <><strong>{pages.length} {pages.length === 1 ? 'page' : 'pages'}</strong><span> from {items.length} {items.length === 1 ? 'PDF' : 'PDFs'}</span></>
              ) : (
                <span>Nothing added yet</span>
              )}
            </div>
            {items.length > 0 && (
              <button
                className="clear-button"
                type="button"
                onClick={() => {
                  setItems([])
                  setPages([])
                  setError('')
                  setNotice('All PDFs removed.')
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <button
            className="merge-button"
            type="button"
            disabled={pages.length < 2 || isMerging}
            onClick={() => void mergePdfs()}
          >
            {isMerging ? (
              <><span className="spinner" /> Creating your PDF...</>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 4.5h4.5v4.5H4zM11.5 4.5H16v4.5h-4.5zM4 11h4.5v4.5H4zM11.5 11H16v4.5h-4.5z" />
                </svg>
                {pages.length >= 2 ? `Create PDF · ${pages.length} pages` : 'Add at least 2 pages'}
                {pages.length >= 2 && <span className="button-arrow" aria-hidden="true">→</span>}
              </>
            )}
          </button>
        </div>

        <div className="privacy-note">
          <span className="lock-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none"><rect x="4.25" y="8.5" width="11.5" height="8" rx="1.75" /><path d="M6.75 8.5V6a3.25 3.25 0 0 1 6.5 0v2.5M10 11.5v2" /></svg>
          </span>
          <span><strong>Private by design.</strong> Your PDFs are processed in this browser and never uploaded to a server.</span>
        </div>
      </section>

      <footer className="site-footer">
        <span>Made for documents that matter.</span>
        <span className="footer-separator">·</span>
        <span>No uploads. No tracking.</span>
      </footer>
    </main>
  )
}

export default App
