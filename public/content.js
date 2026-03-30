console.log('HireTrack content script loaded')

const JOB_CACHE_KEY = 'hiretrack_last_job_details'
const PENDING_DRAFT_KEY = 'hiretrack_pending_draft'
const DRAFT_PREFIX = 'hiretrack_draft_key:'

let observer = null
let checkTimer = null
let lastCheckAt = 0

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function textFromSelector(selector) {
  const element = document.querySelector(selector)
  return cleanText(element?.textContent)
}

function attrFromSelector(selector, attr = 'content') {
  const element = document.querySelector(selector)
  return cleanText(element?.getAttribute(attr))
}

function firstText(selectors) {
  for (const selector of selectors) {
    const value = textFromSelector(selector)
    if (value) return value
  }
  return ''
}

function titleCaseWords(value) {
  return cleanText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function stripCommonCompanySuffixes(value) {
  return cleanText(value)
    .replace(/careers?/gi, '')
    .replace(/jobs?/gi, '')
    .replace(/external/gi, '')
    .replace(/workday/gi, '')
    .replace(/\bwd\d+\b/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCompanyName(value) {
  const cleaned = stripCommonCompanySuffixes(value)
  if (!cleaned) return ''
  return titleCaseWords(cleaned)
}

function cleanWorkdayLocation(value) {
  return cleanText(value)
    .replace(/^locations?/i, '')
    .replace(/^location/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,:-]+\s*/, '')
    .trim()
}

function getSiteType() {
  const host = window.location.hostname

  if (host.includes('linkedin.com')) return 'linkedin'
  if (host.includes('greenhouse.io')) return 'greenhouse'
  if (host.includes('lever.co')) return 'lever'
  if (host.includes('myworkdayjobs.com')) return 'workday'

  return 'generic'
}

function getDraftKey(key) {
  return `${DRAFT_PREFIX}${key}`
}

function alreadyDraftedJob(key) {
  return sessionStorage.getItem(getDraftKey(key)) === 'true'
}

function markDraftedJob(key) {
  sessionStorage.setItem(getDraftKey(key), 'true')
}

function stripUrlQueryAndHash(url) {
  try {
    const parsed = new URL(url, window.location.origin)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url.split('#')[0].split('?')[0]
  }
}

function getCanonicalJobLink() {
  const site = getSiteType()
  const cleanUrl = stripUrlQueryAndHash(window.location.href)

  if (site === 'greenhouse') {
    return cleanUrl.replace(/\/confirmation$/i, '')
  }

  if (site === 'workday') {
    return cleanUrl.replace(/\/apply$/i, '')
  }

  return cleanUrl
}

function getStableJobKey() {
  return getCanonicalJobLink()
}

function getWorkdayCompanyFromHost() {
  const host = window.location.hostname
  const hostParts = host.split('.').filter(Boolean)

  if (!hostParts.length) return ''

  const firstPart = hostParts[0]

  if (
    firstPart &&
    !/^wd\d+$/i.test(firstPart) &&
    !/myworkdayjobs/i.test(firstPart)
  ) {
    return normalizeCompanyName(firstPart)
  }

  return ''
}

function getWorkdayCompanyFromPath() {
  const pathParts = window.location.pathname.split('/').filter(Boolean)

  for (const part of pathParts) {
    const cleaned = normalizeCompanyName(part)

    if (
      cleaned &&
      !/^job$/i.test(cleaned) &&
      !/^apply$/i.test(cleaned) &&
      !/^search$/i.test(cleaned) &&
      !/^en us$/i.test(cleaned)
    ) {
      return cleaned
    }
  }

  return ''
}

function looksLikeGenericRole(role) {
  const value = cleanText(role).toLowerCase()

  if (!value) return true

  return [
    'careers',
    'career',
    'search jobs',
    'search for jobs',
    'jobs',
    'apply',
    'apply now',
    'sign in',
    'job search'
  ].includes(value)
}

function guessCompany() {
  const site = getSiteType()
  const host = window.location.hostname

  if (site === 'greenhouse') {
    const subdomain = host.split('.')[0]
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const genericGreenhouseSubdomains = ['job-boards', 'boards', 'jobs']

    const logoAlt = cleanText(
      document.querySelector('img[alt*="Logo"]')?.getAttribute('alt')
    ).replace(/\s+logo$/i, '')

    const companyFromPage =
      firstText([
        '.company-name',
        '[data-qa="company-name"]',
        '.app-title',
        'header img[alt]',
        'main img[alt]'
      ]) ||
      logoAlt ||
      attrFromSelector('meta[property="og:site_name"]')

    if (companyFromPage && !/job boards/i.test(companyFromPage)) {
      return cleanText(companyFromPage.replace(/\s+logo$/i, ''))
    }

    const bodyText = cleanText(document.body?.innerText || '')
    const aboutMatch = bodyText.match(
      /About\s+([A-Z][A-Za-z0-9&'., ]{2,80}?)\s+\1\s+was founded/i
    )

    if (aboutMatch) {
      return cleanText(aboutMatch[1])
    }

    if (!genericGreenhouseSubdomains.includes(subdomain)) {
      return titleCaseWords(subdomain.replace(/[-_]+/g, ' '))
    }

    if (pathParts[0]) {
      return titleCaseWords(pathParts[0].replace(/[-_]+/g, ' '))
    }

    return ''
  }

  if (site === 'lever') {
    const parts = window.location.pathname.split('/').filter(Boolean)
    if (parts.length > 0) {
      return cleanText(parts[0].replace(/-/g, ' '))
    }
  }

  if (site === 'workday') {
    const companyFromPage =
      firstText([
        '[data-automation-id="company"]',
        '[data-automation-id="jobPostingCompany"]',
        '[data-automation-id="externalOrganizationName"]',
        '[data-automation-id="subtitle"]',
        '[data-automation-id="headerSubtitle"]',
        'header h2',
        'main h2'
      ]) ||
      attrFromSelector('meta[property="og:site_name"]') ||
      getWorkdayCompanyFromHost() ||
      getWorkdayCompanyFromPath()

    return normalizeCompanyName(companyFromPage)
  }

  return firstText([
    '.topcard__org-name-link',
    '.posting-company h2',
    '.company-name',
    '[data-qa="company-name"]'
  ])
}

function guessRole() {
  const site = getSiteType()

  if (site === 'workday') {
    const role =
      firstText([
        '[data-automation-id="jobPostingHeader"]',
        '[data-automation-id="jobPostingTitle"]',
        'main h1',
        'header h1'
      ]) || cleanText(document.title.split('|')[0])

    if (looksLikeGenericRole(role)) return ''

    return role
  }

  if (site === 'greenhouse') {
    const role =
      firstText([
        '[data-qa="posting-name"]',
        '.posting-headline h2',
        'main h1',
        'header h1',
        'h1',
        'h2'
      ]) || cleanText(document.title.split('|')[0])

    if (looksLikeGenericRole(role)) return ''

    return role
  }

  const role =
    firstText([
      'h1',
      'h2',
      '[data-qa="posting-name"]',
      '.posting-headline h2',
      '.topcard__title'
    ]) || cleanText(document.title.split('|')[0])

  if (looksLikeGenericRole(role)) return ''

  return role
}

function guessLocation() {
  const site = getSiteType()

  if (site === 'workday') {
    const rawLocation = firstText([
      '[data-automation-id="locations"]',
      '[data-automation-id="location"]',
      '[data-automation-id="jobPostingLocation"]'
    ])

    return cleanWorkdayLocation(rawLocation)
  }

  if (site === 'greenhouse') {
    return firstText([
      '[data-qa="location"]',
      '.location',
      '.posting-categories .sort-by-location',
      '.posting-categories [class*="location"]'
    ])
  }

  return firstText([
    '.topcard__flavor--bullet',
    '.posting-categories .sort-by-location',
    '[data-qa="location"]',
    '.location'
  ])
}

function buildCurrentPayload() {
  return {
    company: guessCompany(),
    role: guessRole(),
    location: guessLocation(),
    dateApplied: new Date().toISOString().split('T')[0],
    status: 'Applying',
    link: getCanonicalJobLink(),
    notes: ''
  }
}

function getCachedJobDetails() {
  try {
    const raw = sessionStorage.getItem(JOB_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCachedJobDetails(payload) {
  sessionStorage.setItem(JOB_CACHE_KEY, JSON.stringify(payload))
}

function looksLikeUsefulJobPayload(payload) {
  if (!payload) return false
  if (!payload.company) return false
  if (!payload.role) return false
  if (looksLikeGenericRole(payload.role)) return false
  return true
}

function looksLikeJobDetailPage() {
  const site = getSiteType()
  const url = window.location.href.toLowerCase()

  if (site === 'greenhouse') {
    return /\/jobs\/\d+/.test(url)
  }

  if (site === 'lever') {
    return url.includes('/jobs/') || url.includes('/job/')
  }

  if (site === 'workday') {
    return url.includes('/job/') || url.includes('/apply')
  }

  return true
}

function savePendingDraft(payload) {
  try {
    chrome.storage.local.set({
      [PENDING_DRAFT_KEY]: {
        ...payload,
        source: 'autodetect',
        savedAt: Date.now()
      }
    })
  } catch (error) {
    console.log('HireTrack draft storage error:', error)
  }
}

function captureDraftIfReady() {
  if (!looksLikeJobDetailPage()) return

  const current = buildCurrentPayload()
  const cached = getCachedJobDetails()
  const stableKey = getStableJobKey()

  let payload = current

  if (!looksLikeUsefulJobPayload(payload) && looksLikeUsefulJobPayload(cached)) {
    payload = {
      ...cached,
      dateApplied: current.dateApplied || cached.dateApplied,
      link: cached.link || current.link || stableKey,
      status: 'Applying'
    }
  }

  if (!looksLikeUsefulJobPayload(payload)) return
  if (!stableKey) return

  const draftPayload = {
    company: payload.company,
    role: payload.role,
    location: payload.location || '',
    dateApplied: payload.dateApplied || new Date().toISOString().split('T')[0],
    status: 'Applying',
    link: stableKey || payload.link || window.location.href,
    notes: '',
    site: getSiteType(),
    jobKey: stableKey
  }

  const shouldRefreshCache =
    !cached ||
    cached.jobKey !== draftPayload.jobKey ||
    !looksLikeUsefulJobPayload(cached)

  if (shouldRefreshCache) {
    setCachedJobDetails(draftPayload)
  }

  if (alreadyDraftedJob(draftPayload.jobKey)) return

  savePendingDraft(draftPayload)
  chrome.runtime.sendMessage({ type: 'OPEN_HIRETRACK_POPUP' })
  markDraftedJob(draftPayload.jobKey)

  console.log('HireTrack draft captured:', draftPayload)
}

function runCheck(reason) {
  captureDraftIfReady()
  console.log('HireTrack check reason:', reason)
}

function scheduleCheck(reason) {
  clearTimeout(checkTimer)

  checkTimer = setTimeout(() => {
    const now = Date.now()

    if (now - lastCheckAt < 1000) return

    lastCheckAt = now
    runCheck(reason)
  }, 500)
}

function startObserver() {
  const root = document.querySelector('main') || document.body
  if (!root) return

  observer = new MutationObserver(() => {
    scheduleCheck('mutation')
  })

  observer.observe(root, {
    childList: true,
    subtree: true
  })
}

scheduleCheck('initial')
startObserver()

window.addEventListener('load', () => scheduleCheck('load'))
window.addEventListener('popstate', () => scheduleCheck('popstate'))
window.addEventListener('hashchange', () => scheduleCheck('hashchange'))