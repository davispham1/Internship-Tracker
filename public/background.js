chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'OPEN_HIRETRACK_POPUP') return

  chrome.action.openPopup()
    .then(() => sendResponse({ ok: true }))
    .catch(error => {
      console.error('Failed to open popup:', error)
      sendResponse({ ok: false, error: error.message })
    })

  return true
})