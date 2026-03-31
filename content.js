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


    // ─── AUTOFILL ─────────────────────────────────────────────────────────────

    function findInput(patterns) {
        const attrs = ["name", "id", "placeholder", "aria-label", "autocomplete"];
        const inputs = Array.from(document.querySelectorAll(
            "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea"
        ));
        for (const pattern of patterns) {
            for (const el of inputs) {
                for (const attr of attrs) {
                    const val = (el.getAttribute(attr) || "").toLowerCase();
                    if (val.includes(pattern)) return el;
                }
            }
        }
        return null;
    }

    function fillField(el, value) {
        if (!el || !value) return false;
        if (el.value === value) return false;
        const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }

    function runAutofill(profile) {
        const nameParts = (profile.name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const fieldDefs = [
            { value: firstName,        patterns: ["firstname", "first-name", "first_name", "fname", "given-name", "givenname"] },
            { value: lastName,         patterns: ["lastname", "last-name", "last_name", "lname", "surname", "family-name"] },
            { value: profile.name,     patterns: ["fullname", "full-name", "full_name"] },
            { value: profile.email,    patterns: ["email", "e-mail"] },
            { value: profile.phone,    patterns: ["phone", "tel", "mobile", "cell"] },
            { value: profile.linkedin, patterns: ["linkedin"] },
            { value: profile.github,   patterns: ["github"] },
            { value: profile.website,  patterns: ["website", "portfolio", "personal-site", "personalsite"] },
            { value: profile.city,     patterns: ["city", "location"] },
        ];

        let filled = 0;
        for (const { value, patterns } of fieldDefs) {
            if (!value) continue;
            const el = findInput(patterns);
            if (fillField(el, value)) filled++;
        }

        // Fallback: plain "name" field if still empty
        if (profile.name) {
            const el = findInput(["name"]);
            if (el && !el.value && fillField(el, profile.name)) filled++;
        }

        return filled;
    }

    function showAutofillButton(profile) {
        if (document.getElementById("hiretrack-autofill-btn")) return;

        const btn = document.createElement("button");
        btn.id = "hiretrack-autofill-btn";
        btn.textContent = "⚡ HireTrack Autofill";
        Object.assign(btn.style, {
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: "999999",
            background: "#3b82f6",
            color: "#ffffff",
            border: "none",
            padding: "10px 18px",
            borderRadius: "10px",
            cursor: "pointer",
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            fontWeight: "600",
            boxShadow: "0 4px 15px rgba(59,130,246,0.4)",
            transition: "opacity 0.2s",
        });

        btn.addEventListener("mouseenter", () => { btn.style.opacity = "0.85"; });
        btn.addEventListener("mouseleave", () => { btn.style.opacity = "1"; });

        btn.addEventListener("click", () => {
            const filled = runAutofill(profile);
            btn.remove();
            showToast(
                filled > 0
                    ? `Autofilled ${filled} field${filled > 1 ? "s" : ""} with your profile.`
                    : "No matching fields found on this page.",
                () => chrome.runtime.sendMessage({ type: "HIRETRACK_OPEN_DASHBOARD" })
            );
        });

        document.body.appendChild(btn);
    }

    function checkAndShowAutofill() {
        const hasInputs = document.querySelectorAll(
            "input[type=text], input[type=email], input[type=tel], input[type=url], textarea"
        ).length > 0;
        if (!hasInputs) return;

        chrome.storage.local.get("hiretrack_profile", result => {
            const profile = result.hiretrack_profile;
            if (!profile) return;
            if (!profile.name || profile.name === "Your Name") return;
            showAutofillButton(profile);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkAndShowAutofill);
    } else {
        checkAndShowAutofill();
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === "HIRETRACK_TRIGGER_AUTOFILL") {
            chrome.storage.local.get("hiretrack_profile", result => {
                const profile = result.hiretrack_profile;
                if (!profile) {
                    sendResponse({ success: false, filled: 0 });
                    return;
                }
                const filled = runAutofill(profile);
                sendResponse({ success: true, filled });
            });
            return true;
        }
    });

    // ─── END AUTOFILL ─────────────────────────────────────────────────────────

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