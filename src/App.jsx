import { useEffect, useMemo, useState } from 'react'
import {
  addApplication,
  getApplications,
  getProfile,
  saveProfile
} from './storage'

const emptyForm = {
  company: '',
  role: '',
  location: '',
  dateApplied: new Date().toISOString().split('T')[0],
  status: 'Applying',
  link: '',
  notes: ''
}

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [applications, setApplications] = useState([])
  const [expandedIds, setExpandedIds] = useState([])
  const [profile, setProfile] = useState({
    name: 'Your Name',
    email: 'you@example.com'
  })
  const [form, setForm] = useState(emptyForm)

  function prefillApplication(data) {
    setForm({
      ...emptyForm,
      company: data.company || '',
      role: data.role || '',
      location: data.location || '',
      dateApplied: data.dateApplied || new Date().toISOString().split('T')[0],
      status: data.status || 'Applying',
      link: data.link || '',
      notes: data.notes || ''
    })

    setActiveTab('add')
  }

  useEffect(() => {
    async function loadData() {
      const savedApps = await getApplications()
      const savedProfile = await getProfile()
      setApplications(savedApps)
      setProfile(savedProfile)
    }

    loadData()
  }, [])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

    chrome.storage.local.get('hiretrack_pending_draft', result => {
      const draft = result.hiretrack_pending_draft;
      if (!draft) return;
      prefillApplication(draft);
    });
  }, []);

  const recentApplications = useMemo(() => {
    return [...applications]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4)
  }, [applications])

  function toggleExpanded(id) {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  function updateForm(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  async function handleAddInternship(e) {
  e.preventDefault()

  if (!form.company.trim() || !form.role.trim()) {
    alert('Company and role are required')
    return
  }

  const newItem = {
    id: crypto.randomUUID(),
    company: form.company.trim(),
    role: form.role.trim(),
    location: form.location.trim(),
    dateApplied: form.dateApplied,
    status: form.status,
    link: form.link.trim(),
    notes: form.notes.trim(),
    createdAt: Date.now()
  }

  const updated = await addApplication(newItem)
  setApplications(updated)

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.remove('hiretrack_pending_draft')
  }

  setForm({
    ...emptyForm,
    dateApplied: new Date().toISOString().split('T')[0]
  })
  setActiveTab('home')
}

  function handleClearForm() {
  setForm({
    ...emptyForm,
    dateApplied: new Date().toISOString().split('T')[0]
  })

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.remove('hiretrack_pending_draft')
  }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    await saveProfile(profile)
    alert('Profile saved')
  }

  function openDashboard() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
      })
      return
    }

    window.open('/dashboard.html', '_blank')
  }

  return (
    <div className="appShell">
      <div className="content">
        <header className="topHeader">
          <div>
            <p className="eyebrow">HireTrack</p>
            <h1>{profile.name || 'Your Profile'}</h1>
          </div>
          <button className="smallPrimaryBtn" onClick={openDashboard}>
            Dashboard
          </button>
        </header>

        {activeTab === 'home' && (
          <section className="screen">
            <div className="panel">
              <div className="sectionHeader">
                <p className="sectionLabel">Recent Applications</p>
              </div>

              {recentApplications.length === 0 ? (
                <div className="emptyCard">
                  <p>No applications yet</p>
                  <button className="primaryBtn" onClick={() => setActiveTab('add')}>
                    Add internship
                  </button>
                </div>
              ) : (
                <div className="recentList">
                  {recentApplications.map(item => {
                    const expanded = expandedIds.includes(item.id)

                    return (
                      <div className="recentCard" key={item.id}>
                        <button
                          className="recentCardTop"
                          onClick={() => toggleExpanded(item.id)}
                        >
                          <div>
                            <h2>{item.company}</h2>
                            <p className="roleText">{item.role}</p>
                          </div>

                          <div className="recentRight">
                            <span className="statusPill">{item.status}</span>
                            <span className="expandText">
                              {expanded ? 'Hide' : 'View'}
                            </span>
                          </div>
                        </button>

                        {expanded && (
                          <div className="expandedBlock">
                            {item.location && (
                              <p>
                                <strong>Location:</strong> {item.location}
                              </p>
                            )}

                            {item.dateApplied && (
                              <p>
                                <strong>Date:</strong> {item.dateApplied}
                              </p>
                            )}

                            {item.link && (
                              <p>
                                <strong>Link:</strong>{' '}
                                <a href={item.link} target="_blank" rel="noreferrer">
                                  Open application
                                </a>
                              </p>
                            )}

                            {item.notes && (
                              <p>
                                <strong>Notes:</strong> {item.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'add' && (
          <section className="screen">
            <div className="panel">
              <p className="sectionLabel">Add Internship</p>

              <form className="form" onSubmit={handleAddInternship}>
                <input
                  type="text"
                  placeholder="Company"
                  value={form.company}
                  onChange={e => updateForm('company', e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Role"
                  value={form.role}
                  onChange={e => updateForm('role', e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Location"
                  value={form.location}
                  onChange={e => updateForm('location', e.target.value)}
                />

                <input
                  type="date"
                  value={form.dateApplied}
                  onChange={e => updateForm('dateApplied', e.target.value)}
                />

                <select
                  value={form.status}
                  onChange={e => updateForm('status', e.target.value)}
                >
                  <option value="Applying">Applying</option>
                  <option value="Applied">Applied</option>
                  <option value="OA">OA</option>
                  <option value="Interview">Interview</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                </select>

                <input
                  type="url"
                  placeholder="Application link"
                  value={form.link}
                  onChange={e => updateForm('link', e.target.value)}
                />

                <textarea
                  rows="3"
                  placeholder="Notes"
                  value={form.notes}
                  onChange={e => updateForm('notes', e.target.value)}
                />

                <div className="formActions">
                  <button className="primaryBtn" type="submit">
                    Save internship
                  </button>

                  <button
                    className="secondaryBtn"
                    type="button"
                    onClick={handleClearForm}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="screen">
            <div className="panel">
              <p className="sectionLabel">Profile</p>

              <form className="form" onSubmit={handleSaveProfile}>
                <input
                  type="text"
                  placeholder="Your name"
                  value={profile.name}
                  onChange={e =>
                    setProfile(prev => ({
                      ...prev,
                      name: e.target.value
                    }))
                  }
                />

                <input
                  type="email"
                  placeholder="Your email"
                  value={profile.email}
                  onChange={e =>
                    setProfile(prev => ({
                      ...prev,
                      email: e.target.value
                    }))
                  }
                />

                <button className="primaryBtn" type="submit">
                  Save profile
                </button>

                <button
                  className="secondaryBtn"
                  type="button"
                  onClick={openDashboard}
                >
                  Open dashboard
                </button>
              </form>
            </div>
          </section>
        )}
      </div>

      <footer className="footerNav">
        <button
          className={activeTab === 'home' ? 'navBtn active' : 'navBtn'}
          onClick={() => setActiveTab('home')}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          className={activeTab === 'add' ? 'navBtn active' : 'navBtn'}
          onClick={() => setActiveTab('add')}
        >
          <span>＋</span>
          <small>Add</small>
        </button>

        <button
          className={activeTab === 'profile' ? 'navBtn active' : 'navBtn'}
          onClick={() => setActiveTab('profile')}
        >
          <span>◉</span>
          <small>Profile</small>
        </button>
      </footer>
    </div>
  )
}

export default App