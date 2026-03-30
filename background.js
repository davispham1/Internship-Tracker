chrome.runtime.onInstalled.addListener(() => {
    console.log("HireTrack extension installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "HIRETRACK_SAVE_DRAFT") {
        chrome.storage.local.set(
            { hiretrack_pending_draft: message.payload },
            () => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                    return;
                }

                sendResponse({ success: true });
            }
        );

        return true;
    }

    if (message?.type === "HIRETRACK_OPEN_DASHBOARD") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
        sendResponse({ success: true });
    }
});