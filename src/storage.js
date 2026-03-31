const APPLICATIONS_KEY = 'internship_applications'
const PROFILE_KEY = 'hiretrack_profile'

export async function getApplications() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.get([APPLICATIONS_KEY], result => {
        resolve(result[APPLICATIONS_KEY] || [])
      })
    })
  }

  const raw = localStorage.getItem(APPLICATIONS_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function addApplication(item) {
  const existing = await getApplications()
  const updated = [item, ...existing]

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [APPLICATIONS_KEY]: updated }, () => {
        resolve(updated)
      })
    })
  }

  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated))
  return updated
}

export async function updateApplication(id, updates) {
  const existing = await getApplications()
  const updated = existing.map(item =>
    item.id === id ? { ...item, ...updates } : item
  )

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [APPLICATIONS_KEY]: updated }, () => {
        resolve(updated)
      })
    })
  }

  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated))
  return updated
}

export async function deleteApplication(id) {
  const existing = await getApplications()
  const updated = existing.filter(item => item.id !== id)

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [APPLICATIONS_KEY]: updated }, () => {
        resolve(updated)
      })
    })
  }

  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(updated))
  return updated
}

export async function getProfile() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.get([PROFILE_KEY], result => {
        resolve(
          result[PROFILE_KEY] || {
            name: 'Your Name',
            email: 'you@example.com',
            phone: '',
            linkedin: '',
            github: '',
            website: '',
            city: ''
          }
        )
      })
    })
  }

  const raw = localStorage.getItem(PROFILE_KEY)
  return raw
    ? JSON.parse(raw)
    : {
        name: 'Your Name',
        email: 'you@example.com',
        phone: '',
        linkedin: '',
        github: '',
        website: '',
        city: ''
      }
}

export async function saveProfile(profile) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [PROFILE_KEY]: profile }, () => {
        resolve(profile)
      })
    })
  }

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  return profile
}