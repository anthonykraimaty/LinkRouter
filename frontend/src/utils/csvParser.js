const VALID_TYPES = ['pdf', 'image', 'video_link', 'video_file', 'redirect']
const FILE_TYPES = ['pdf', 'image', 'video_file']
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// 'home' stays creatable — it backs the root "/" path.
const RESERVED_SLUGS = new Set([
  'admin', 'manage', 'api', 'uploads', 'favicon.ico', 'login', 'setup',
  'static', 'assets', 'public', 'health', 'status',
])

function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function isHeaderRow(fields) {
  const headers = fields.map(f => f.toLowerCase())
  return headers.includes('title') && (headers.includes('route') || headers.includes('slug')) && headers.includes('type')
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { rows: [], errors: ['CSV file is empty'] }

  let startIndex = 0
  const firstFields = parseCSVLine(lines[0])
  if (isHeaderRow(firstFields)) {
    startIndex = 1
  }

  const rows = []
  const errors = []
  const seenSlugs = new Set()

  for (let i = startIndex; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const rowNumber = i + 1
    const validationErrors = []

    const title = fields[0] || ''
    const slug = (fields[1] || '').toLowerCase().trim()
    const type = (fields[2] || '').toLowerCase().trim()
    const link = fields[3] || ''

    if (!title) validationErrors.push('Title is required')
    if (!slug) {
      validationErrors.push('Route/slug is required')
    } else {
      if (!SLUG_REGEX.test(slug)) {
        validationErrors.push('Slug must contain only lowercase letters, numbers, and hyphens')
      }
      if (RESERVED_SLUGS.has(slug)) {
        validationErrors.push(`Slug "${slug}" is reserved`)
      }
      if (seenSlugs.has(slug)) {
        validationErrors.push(`Duplicate slug "${slug}" in CSV`)
      }
      seenSlugs.add(slug)
    }

    if (!VALID_TYPES.includes(type)) {
      validationErrors.push(`Type must be one of: ${VALID_TYPES.join(', ')}`)
    }

    if ((type === 'redirect' || type === 'video_link') && !link) {
      validationErrors.push(`Link/URL is required for type "${type}"`)
    }

    rows.push({
      rowNumber,
      title,
      slug,
      type,
      link,
      needsFile: FILE_TYPES.includes(type),
      validationErrors,
    })
  }

  return { rows, errors }
}
