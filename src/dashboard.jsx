import React from 'react'
import ReactDOM from 'react-dom/client'
import { useEffect, useMemo, useState } from 'react'
import {
  deleteApplication,
  getApplications,
  updateApplication
} from './storage'
import './dashboard.css'

const STATUS_ORDER = ['Applying', 'Applied', 'OA', 'Interview', 'Offer', 'Rejected']

const STATUS_COLORS = {
  Applying: '#94a3b8',
  Applied: '#60a5fa',
  OA: '#a78bfa',
  Interview: '#f59e0b',
  Offer: '#22c55e',
  Rejected: '#f87171'
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getApplicationDateKey(item) {
  if (item.dateApplied) return item.dateApplied

  if (item.createdAt) {
    return formatDateKey(new Date(item.createdAt))
  }

  return null
}

function getStatusCounts(applications) {
  const counts = {
    Applying: 0,
    Applied: 0,
    OA: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0
  }

  for (const item of applications) {
    const status = item.status || 'Applying'
    if (counts[status] !== undefined) {
      counts[status] += 1
    }
  }

  return counts
}

function getStatusPercent(count, total) {
  if (!total) return '0%'
  return `${Math.round((count / total) * 100)}%`
}

function buildPieBackground(statusCounts) {
  const total = Object.values(statusCounts).reduce((sum, value) => sum + value, 0)

  if (!total) {
    return 'conic-gradient(#e5e7eb 0% 100%)'
  }

  let current = 0
  const slices = []

  for (const status of STATUS_ORDER) {
    const count = statusCounts[status]
    if (!count) continue

    const start = (current / total) * 100
    current += count
    const end = (current / total) * 100

    slices.push(`${STATUS_COLORS[status]} ${start}% ${end}%`)
  }

  return `conic-gradient(${slices.join(', ')})`
}

function getHeatmapData(applications, year) {
  const countsByDate = {}

  for (const item of applications) {
    const key = getApplicationDateKey(item)
    if (!key) continue
    if (!key.startsWith(`${year}-`)) continue

    countsByDate[key] = (countsByDate[key] || 0) + 1
  }

  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)

  const start = new Date(jan1)
  start.setDate(start.getDate() - start.getDay())

  const end = new Date(dec31)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const cells = []
  const monthLabels = []
  let weekIndex = 0
  let lastMonthSeen = -1

  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    if (current.getDay() === 0) {
      const inCurrentYear = current.getFullYear() === year
      const month = current.getMonth()

      if (inCurrentYear && month !== lastMonthSeen) {
        monthLabels.push({
          label: current.toLocaleString('default', { month: 'short' }),
          column: weekIndex + 1
        })
        lastMonthSeen = month
      }

      weekIndex += 1
    }

    const dateKey = formatDateKey(current)
    const inYear = current.getFullYear() === year

    cells.push({
      key: dateKey,
      date: dateKey,
      count: inYear ? countsByDate[dateKey] || 0 : 0,
      empty: !inYear
    })
  }

  const maxCount = Math.max(0, ...Object.values(countsByDate))

  return {
    cells,
    maxCount,
    monthLabels,
    weekCount: weekIndex
  }
}

function getHeatLevel(count, maxCount) {
  if (!count) return 'level0'
  if (maxCount <= 1) return 'level4'

  const ratio = count / maxCount

  if (ratio <= 0.25) return 'level1'
  if (ratio <= 0.5) return 'level2'
  if (ratio <= 0.75) return 'level3'
  return 'level4'
}

function DashboardApp() {
  const [applications, setApplications] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    async function loadData() {
      const savedApps = await getApplications()
      setApplications(savedApps)
    }

    loadData()

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const listener = changes => {
        if (changes.internship_applications) {
          setApplications(changes.internship_applications.newValue || [])
        }
      }

      chrome.storage.onChanged.addListener(listener)

      return () => {
        chrome.storage.onChanged.removeListener(listener)
      }
    }
  }, [])

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => b.createdAt - a.createdAt)
  }, [applications])

  const filteredApplications = useMemo(() => {
    return sortedApplications.filter(item => {
      const matchesStatus =
        statusFilter === 'All' || item.status === statusFilter

      const haystack =
        `${item.company} ${item.role} ${item.location} ${item.notes}`.toLowerCase()

      const matchesSearch = haystack.includes(search.toLowerCase())

      return matchesStatus && matchesSearch
    })
  }, [sortedApplications, search, statusFilter])

  const counts = useMemo(() => {
    return {
      total: applications.length,
      applied: applications.filter(item => item.status === 'Applied').length,
      interview: applications.filter(item => item.status === 'Interview').length,
      offer: applications.filter(item => item.status === 'Offer').length
    }
  }, [applications])

  const statusCounts = useMemo(() => getStatusCounts(applications), [applications])

  const totalApplications = applications.length

  const currentYear = useMemo(() => {
    if (!applications.length) return new Date().getFullYear()

    const dates = applications
      .map(getApplicationDateKey)
      .filter(Boolean)

    if (!dates.length) return new Date().getFullYear()

    return Math.max(...dates.map(date => Number(date.slice(0, 4))))
  }, [applications])

  const heatmap = useMemo(() => {
    return getHeatmapData(applications, currentYear)
  }, [applications, currentYear])

  async function handleStatusChange(id, status) {
    const updated = await updateApplication(id, { status })
    setApplications(updated)
  }

  async function handleDelete(id) {
    const ok = window.confirm('Delete this application?')
    if (!ok) return

    const updated = await deleteApplication(id)
    setApplications(updated)
  }

  return (
    <div className="dashboardPage">
      <header className="dashboardHeader">
        <div>
          <p className="dashboardEyebrow">HireTrack</p>
          <h1>Internship Applications</h1>
          <p className="dashboardSubtext">A Visual Job Application Tracking System for College Students</p>
        </div>
      </header>

            <section className="overviewRow">
        <div className="analyticsCard funnelCard">
          <div className="cardHeader">
            <div>
              <p className="cardEyebrow">Status Ratio</p>
              <h2>Application Funnel</h2>
            </div>
          </div>

          <div className="pieSection">
            <div
              className="donutChart"
              style={{ background: buildPieBackground(statusCounts) }}
            >
              <div className="donutCenter">
                <strong>{totalApplications}</strong>
                <span>Total</span>
              </div>
            </div>

            <div className="legendList">
                {STATUS_ORDER.map(status => (
                    <div className="legendItem" key={status}>
                    <div className="legendLeft">
                        <span
                        className="legendDot"
                        style={{ background: STATUS_COLORS[status] }}
                        />
                        <span>{status}</span>
                    </div>

                    <div className="legendRight">
                        <strong>{statusCounts[status]}</strong>
                        <span>{getStatusPercent(statusCounts[status], totalApplications)}</span>
                    </div>
                    </div>
                ))}
                </div>
          </div>
        </div>

        <section className="statsGrid summaryGrid">
            <div className="statBox">
                <span>Applying</span>
                <strong>{statusCounts.Applying}</strong>
            </div>
            <div className="statBox">
                <span>Applied</span>
                <strong>{statusCounts.Applied}</strong>
            </div>
            <div className="statBox">
                <span>OA</span>
                <strong>{statusCounts.OA}</strong>
            </div>
            <div className="statBox">
                <span>Interview</span>
                <strong>{statusCounts.Interview}</strong>
            </div>
            <div className="statBox">
                <span>Offer</span>
                <strong>{statusCounts.Offer}</strong>
            </div>
            <div className="statBox">
                <span>Rejected</span>
                <strong>{statusCounts.Rejected}</strong>
            </div>
        </section>
      </section>

      <section className="analyticsCard heatmapSection">
        <div className="cardHeader">
          <div>
            <p className="cardEyebrow">Daily Activity</p>
            <h2>{currentYear} Heatmap</h2>
          </div>
        </div>

        <div className="heatmapLegend">
          <span>Less</span>
          <div className="legendScale">
            <span className="heatCell level0" />
            <span className="heatCell level1" />
            <span className="heatCell level2" />
            <span className="heatCell level3" />
            <span className="heatCell level4" />
          </div>
          <span>More</span>
        </div>

        <div className="heatmapScroller">
          <div className="heatmapBoard">
            <div
              className="monthLabels"
              style={{ gridTemplateColumns: `repeat(${heatmap.weekCount}, 18px)` }}
            >
              {heatmap.monthLabels.map(item => (
                <span
                  key={`${item.label}-${item.column}`}
                  className="monthLabel"
                  style={{ gridColumn: item.column }}
                >
                  {item.label}
                </span>
              ))}
            </div>

            <div className="heatmapWrap">
              <div className="heatmapLabels">
                <span>S</span>
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
              </div>

              <div className="heatmapGrid">
                {heatmap.cells.map(cell => {
                  if (cell.empty) {
                    return <span className="heatCell empty" key={cell.key} />
                  }

                  return (
                    <span
                      key={cell.key}
                      className={`heatCell ${getHeatLevel(cell.count, heatmap.maxCount)}`}
                      title={`${cell.date}: ${cell.count} application${cell.count === 1 ? '' : 's'}`}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="toolbar">
        <input
          type="text"
          placeholder="Search company, role, location, or notes"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            >
            <option value="All">All statuses</option>
            <option value="Applying">Applying</option>
            <option value="Applied">Applied</option>
            <option value="OA">OA</option>
            <option value="Interview">Interview</option>
            <option value="Offer">Offer</option>
            <option value="Rejected">Rejected</option>
        </select>
      </section>

      <section className="dashboardList">
        {filteredApplications.length === 0 ? (
          <div className="emptyDashboardCard">No applications found</div>
        ) : (
          filteredApplications.map(item => (
            <div className="dashboardCard" key={item.id}>
              <div className="dashboardCardTop">
                <div>
                  <h2>{item.company}</h2>
                  <p className="dashboardRole">{item.role}</p>
                </div>

                <select
                    value={item.status}
                    onChange={e => handleStatusChange(item.id, e.target.value)}
                    >
                    <option value="Applying">Applying</option>
                    <option value="Applied">Applied</option>
                    <option value="OA">OA</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="dashboardMeta">
                {item.location && (
                  <p>
                    <strong>Location:</strong> {item.location}
                  </p>
                )}

                {item.dateApplied && (
                  <p>
                    <strong>Date Applied:</strong> {item.dateApplied}
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

              <button className="deleteBtn" onClick={() => handleDelete(item.id)}>
                Delete
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('dashboard-root')).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>
)