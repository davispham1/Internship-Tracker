(function () {

    if (window.__hiretrackInjected) return;
    window.__hiretrackInjected = true;

    function getText(selector) {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : "";
    }

    function getValue(selector) {
        const el = document.querySelector(selector);
        return el ? (el.value || "").trim() : "";
    }

    function buildDraftFromPage() {

        const company =
            getText("[data-hiretrack-company]") ||
            getValue("[data-hiretrack-company-input]") ||
            document.title.split(" - ")[0] ||
            "";

        const role =
            getText("[data-hiretrack-role]") ||
            getValue("[data-hiretrack-role-input]") ||
            "";

        const location =
            getText("[data-hiretrack-location]") ||
            getValue("[data-hiretrack-location-input]") ||
            "";

        return {
            company,
            role,
            location,
            dateApplied: new Date().toISOString().split("T")[0],
            status: "Applied",
            link: window.location.href,
            notes: "Auto-detected from page submission"
        };
    }

    function showToast(message, onOpen) {
        const oldToast = document.getElementById("hiretrack-toast");
        if (oldToast) oldToast.remove();

        const toast = document.createElement("div");
        toast.id = "hiretrack-toast";
        toast.style.position = "fixed";
        toast.style.top = "20px";
        toast.style.right = "20px";
        toast.style.zIndex = "999999";
        toast.style.background = "#111827";
        toast.style.color = "#ffffff";
        toast.style.padding = "14px 16px";
        toast.style.borderRadius = "12px";
        toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
        toast.style.fontFamily = "Arial, sans-serif";
        toast.style.fontSize = "14px";
        toast.style.maxWidth = "300px";

        toast.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 6px;">HireTrack</div>
      <div style="margin-bottom: 10px;">${message}</div>
      <button id="hiretrack-open-btn" style="
        background:#3b82f6;
        color:white;
        border:none;
        padding:8px 12px;
        border-radius:8px;
        cursor:pointer;
      ">Open Dashboard</button>
    `;

        document.body.appendChild(toast);

        document
            .getElementById("hiretrack-open-btn")
            .addEventListener("click", () => {
                onOpen();
            });

        setTimeout(() => {
            toast.remove();
        }, 7000);
    }

    function saveDraftAndPrompt() {
        const payload = buildDraftFromPage();

        if (!payload.company && !payload.role) return;

        chrome.runtime.sendMessage(
            {
                type: "HIRETRACK_SAVE_DRAFT",
                payload
            },
            (response) => {
                if (!response?.success) {
                    console.error("HireTrack draft save failed", response?.error);
                    return;
                }

                showToast(
                    "Application detected. Draft saved to HireTrack.",
                    () => {
                        chrome.runtime.sendMessage({ type: "HIRETRACK_OPEN_DASHBOARD" });
                    }
                );
            }
        );
    }


    document.addEventListener("click", (event) => {
        const target = event.target.closest("[data-hiretrack-submit]");
        if (!target) return;


        setTimeout(() => {
            saveDraftAndPrompt();
        }, 300);
    });

    const observer = new MutationObserver(() => {
        const successBanner = document.querySelector("[data-hiretrack-success]");
        if (successBanner && !successBanner.dataset.hiretrackHandled) {
            successBanner.dataset.hiretrackHandled = "true";
            saveDraftAndPrompt();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();