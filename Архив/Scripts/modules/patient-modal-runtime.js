async ({ dv }) => {
    const CORE_SOURCE_PATH = "Архив/Scripts/src/shared/desktop-parser-ui.cjs";
    const CHAT_STYLE_SOURCE_PATH = "Архив/Scripts/src/shared/patient-modal-chat-style.cjs";
    let corePromise = null;
    let stylePromise = null;
    const loadCore = async () => {
        if (!corePromise) {
            corePromise = (async () => {
                const source = await dv.io.load(CORE_SOURCE_PATH);
                if (!source) throw new Error(`Patient modal UI source not found: ${CORE_SOURCE_PATH}`);
                const module = { exports: {} };
                const exports = module.exports;
                const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
                return factory(module, exports);
            })();
        }
        return corePromise;
    };
    const loadChatStyles = async () => {
        if (!stylePromise) {
            stylePromise = (async () => {
                const source = await dv.io.load(CHAT_STYLE_SOURCE_PATH);
                if (!source) throw new Error(`Patient modal chat style source not found: ${CHAT_STYLE_SOURCE_PATH}`);
                const module = { exports: {} };
                const exports = module.exports;
                const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
                return factory(module, exports);
            })();
        }
        return stylePromise;
    };

    const adaptModalContext = (context = {}) => ({
        ...context,
        _dbMergeDiagnosisText: context._dbMergeDiagnosisText || context.mergeDiagnosisText || ((left, right) => right ?? left ?? ""),
        _npNormalizeLabDateKey: context._npNormalizeLabDateKey || context.normalizeLabDateKey || ((value) => String(value || "")),
        _npMatchEcogInText: context._npMatchEcogInText || context.matchEcogInText || (() => null),
        _npNormalizeEcog: context._npNormalizeEcog || context.normalizeEcog || ((value) => value),
        _dbNormalizeHistoryText: context._dbNormalizeHistoryText || context.normalizeHistoryText || ((value) => String(value || "")),
        _dbNormalizeDrugNames: context._dbNormalizeDrugNames || context.normalizeDrugNames || ((value) => String(value || "")),
        _dbNormalizeDiagnosisText: context._dbNormalizeDiagnosisText || context.normalizeDiagnosisText || ((value) => String(value || "")),
        _dbResolvePatientId: context._dbResolvePatientId || context.resolveCurrentPatientId || (async () => null),
        ensureCurrentPatientId: context.ensureCurrentPatientId || context.resolveCurrentPatientId || (async () => "")
    });

    const buildAiPanel = async (context = {}) => {
        const core = await loadCore();
        return core.buildAiPanel(adaptModalContext(context));
    };

    const ensureChatStyles = async (doc = document) => {
        const styleModule = await loadChatStyles();
        if (styleModule?.ensurePatientChatStyles) {
            styleModule.ensurePatientChatStyles(doc);
        }
    };

    const getChatKey = () => localStorage.getItem("or_api_key") || "";
    const getChatModel = () => (localStorage.getItem("or_chat_model") || "google/gemini-3-flash-preview").replace(/^openrouter\//, "");
    const anonymizeCtx = (txt, getStoredVal = () => null) => {
        let s = String(txt || "");
        s = s.replace(/\d{3}[\s\-]\d{3}[\s\-]\d{3}[\s\-]\d{2}|\b\d{11}\b/g, "[SNILS]");
        s = s.replace(/(?:\+7|8)[\s\-\(]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, "[PHONE]");
        const fio = getStoredVal("ФИО") || "";
        if (fio) s = s.replace(new RegExp(fio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[PATIENT_NAME]");
        else s = s.replace(/[\u0410-\u042f\u0401][\u0430-\u044f\u0451]+\s+[\u0410-\u042f\u0401][\u0430-\u044f\u0451]+\s+[\u0410-\u042f\u0401][\u0430-\u044f\u0451]+/g, "[PATIENT_NAME]");
        return s;
    };

    const openPatientChatModal = async (context = {}) => {
        const {
            cur,
            getVal = () => null,
            getStoredVal = () => null,
            saveNow = async () => {},
            refreshStoredFrontmatter = async () => ({}),
            overallEnd = null,
            window: ctxWindow = window,
            document: ctxDocument = document,
            dv: ctxDv = dv
        } = context;

        await ensureChatStyles(ctxDocument);

        const chatId = String(cur?.file?.path || "patient").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        const chatModalId = `ai-chat-modal-${chatId}`;
        if (ctxDocument.getElementById(chatModalId)) return;

        const overlay = ctxDocument.createElement("div");
        overlay.id = chatModalId;
        overlay.className = "pf0-overlay ai-chat-overlay";

        const cleanup = [];
        const addCleanup = (fn) => { if (typeof fn === "function") cleanup.push(fn); };
        const isMobile = () => ctxWindow.matchMedia ? ctxWindow.matchMedia("(max-width: 640px)").matches : ctxWindow.innerWidth <= 640;
        const close = () => {
            while (cleanup.length) {
                const fn = cleanup.pop();
                try { fn(); } catch (_) {}
            }
            overlay.remove();
            ctxDocument.removeEventListener("keydown", onEsc);
        };
        const onEsc = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
        ctxDocument.addEventListener("keydown", onEsc);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay && !isMobile()) close();
        });

        const modal = ctxDocument.createElement("div");
        modal.className = "pf0-modal ai-chat-modal";

        const header = ctxDocument.createElement("div");
        header.className = "pf0-modal-header ai-chat-header";
        const title = ctxDocument.createElement("div");
        title.className = "pf0-modal-title ai-chat-title-text";
        title.innerHTML = "✨ Умный медицинский ИИ";
        title.style.cssText = "background:linear-gradient(90deg,#6200ea,#b388ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;";

        const clearBtn = ctxDocument.createElement("button");
        clearBtn.className = "ai-chat-head-btn ai-chat-clear-btn";
        clearBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;
        clearBtn.title = "Очистить чат";

        const closeBtn = ctxDocument.createElement("button");
        closeBtn.className = "pf0-modal-close ai-chat-head-btn ai-chat-close-btn";
        closeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1.35" y1="1.35" x2="11.65" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11.65" y1="1.35" x2="1.35" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        closeBtn.title = "Закрыть (Esc)";
        closeBtn.onclick = (e) => { e.stopPropagation(); close(); };

        const rightBtns = ctxDocument.createElement("div");
        rightBtns.className = "ai-chat-header-right";
        rightBtns.appendChild(clearBtn);
        rightBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(rightBtns);
        modal.appendChild(header);

        const hist = ctxDocument.createElement("div");
        hist.className = "ai-chat-hist";
        let chatHistory = Array.isArray(getStoredVal("Чат_история")) ? [...getStoredVal("Чат_история")] : [];
        let typing = false;
        const renderHist = () => {
            hist.innerHTML = "";
            clearBtn.style.display = chatHistory.length === 0 ? "none" : "flex";
            if (chatHistory.length === 0) {
                hist.innerHTML = `<div style="text-align:center;padding:48px 0;opacity:0.6;"><span style="font-size:48px;display:block;margin-bottom:12px;">🤖</span><span style="font-size:15px;font-weight:600;color:var(--text-normal);">Я готов проанализировать эту карту!</span><br/><span style="font-size:12px;color:var(--text-muted);">Задайте любой вопрос или попросите суммаризовать данные</span></div>`;
            } else {
                chatHistory.forEach((m) => {
                    const b = ctxDocument.createElement("div");
                    b.className = m.role === "user" ? "ai-msg-u" : "ai-msg-a";
                    b.innerHTML = m.role === "user" ? m.content : (ctxWindow.marked?.parse(m.content) || m.content);
                    hist.appendChild(b);
                });
            }
            if (typing) {
                const tv = ctxDocument.createElement("div");
                tv.className = "ai-typing";
                tv.innerHTML = "<span></span><span></span><span></span>";
                hist.appendChild(tv);
            }
            setTimeout(() => { hist.scrollTop = hist.scrollHeight; }, 30);
        };
        clearBtn.onclick = async (e) => {
            e.stopPropagation();
            chatHistory = [];
            await saveNow({ "Чат_история": [] });
            renderHist();
        };
        renderHist();
        modal.appendChild(hist);

        const extCtx = (() => {
            const parts = [];
            if (typeof overallEnd !== "undefined" && overallEnd) {
                parts.push(`(Авто-расчет) Дата окончания текущего плана лечения: ${overallEnd.toFormat("dd.MM.yyyy")}`);
            }
            const related = getStoredVal("Связанные_случаи");
            if (related) {
                const list = Array.isArray(related) ? related : [related];
                const names = list.map((x) => String(x).replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0]);
                const linkData = [];
                names.forEach((name) => {
                    const p = ctxDv.pages().find((pg) => pg.file.name === name);
                    if (p) {
                        linkData.push(`- Случай [${name}]: Диагноз/Этап: ${p["Диагноз"] || "Нет"}, Лечение начато: ${p["Дата_начала_лечения"] || "Нет"}, Фракций ХЛТ: ${p["Количество_фракций"] || "Нет"}`);
                    }
                });
                if (linkData.length) parts.push(`ПРОШЛЫЕ/СВЯЗАННЫЕ СЛУЧАИ ПАЦИЕНТА:\n${linkData.join("\n")}`);
            }
            return parts.join("\n\n");
        })();
        if (extCtx.length > 5) {
            const ctxInfo = ctxDocument.createElement("div");
            ctxInfo.className = "ai-scan-context-info";
            ctxInfo.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Сканирует связанные госпитализации и расчеты`;
            modal.appendChild(ctxInfo);
        }

        const footer = ctxDocument.createElement("div");
        footer.className = "ai-chat-footer";
        const footerTop = ctxDocument.createElement("div");
        footerTop.className = "ai-chat-footer-top";
        const inputRow = ctxDocument.createElement("div");
        inputRow.className = "ai-chat-inp-wrap";
        const inp = ctxDocument.createElement("input");
        inp.className = "ai-chat-inp";
        inp.type = "text";
        inp.inputMode = "text";
        inp.enterKeyHint = "send";
        inp.autocomplete = "off";
        inp.placeholder = "Спросить про пациента или план лечения...";

        const modelSel = ctxDocument.createElement("select");
        modelSel.className = "ai-chat-model-select";
        [
            { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
            { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
            { id: "qwen/qwen3.6-plus", label: "Qwen 3.6 Plus" },
            { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5" }
        ].forEach((m) => {
            const o = ctxDocument.createElement("option");
            o.value = m.id;
            o.textContent = m.label;
            if (getChatModel() === m.id) o.selected = true;
            modelSel.appendChild(o);
        });
        modelSel.onchange = () => localStorage.setItem("or_chat_model", modelSel.value);

        const sendBtn = ctxDocument.createElement("button");
        sendBtn.className = "ai-send-btn";
        sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

        const errEl = ctxDocument.createElement("div");
        errEl.className = "ai-chat-error";
        const showErr = (msg) => {
            errEl.textContent = msg;
            errEl.style.color = "#f44336";
            errEl.style.display = "block";
            setTimeout(() => { errEl.style.display = "none"; }, 5000);
        };
        const scrollBottom = (delay = 40) => setTimeout(() => { hist.scrollTop = hist.scrollHeight; }, delay);

        const doSend = async () => {
            const q = inp.value.trim();
            if (!q) return;
            const key = getChatKey();
            if (!key) { showErr("⚠️ Откройте главные настройки чтобы сохранить API-ключ"); return; }
            await refreshStoredFrontmatter?.();

            inp.value = "";
            inp.disabled = true;
            sendBtn.disabled = true;
            chatHistory.push({ role: "user", content: q });
            typing = true;
            renderHist();
            scrollBottom(20);

            try {
                const coreCtxRaw = [
                    `МКБ: ${getVal("МКБ 10") || ""}`,
                    `Диагноз: ${getVal("Диагноз") || ""}`,
                    getVal("Анамнез_заболевания") ? `Анамнез: ${getVal("Анамнез_заболевания")}` : "",
                    getVal("Описания_исследований") ? `Исследования: ${getVal("Описания_исследований")}` : "",
                    getVal("Решение_консилиума") ? `Консилиум: ${getVal("Решение_консилиума")}` : ""
                ].filter(Boolean).join("\n");
                let finalCtx = anonymizeCtx(coreCtxRaw, getStoredVal);
                if (extCtx) finalCtx += `\n\n${extCtx}`;

                const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: modelSel.value || getChatModel(),
                        messages: [
                            { role: "system", content: `Ты — медицинский ИИ-ассистент врача-онколога. Отвечай кратко, емко, и опираясь ТОЛЬКО на предоставленный контекст карты пациента и связанных случаев. Если данных нет, так и скажи. Форматируй ответ с помощью Markdown (используй списки и выделение жирным шрифтом где необходимо)\n\nКОНТЕКСТ:\n${finalCtx}` },
                            ...chatHistory.slice(-15)
                        ]
                    })
                });
                if (!resp.ok) {
                    const et = await resp.text();
                    throw new Error(`HTTP ${resp.status}: ${et.slice(0, 100)}`);
                }
                const rj = await resp.json();
                const aiMsg = rj?.choices?.[0]?.message?.content || "";
                chatHistory.push({ role: "assistant", content: aiMsg });
                await saveNow({ "Чат_история": chatHistory });
            } catch (e) {
                chatHistory.push({ role: "assistant", content: "❌ Ошибка: " + e.message });
            }

            typing = false;
            inp.disabled = false;
            sendBtn.disabled = false;
            renderHist();
            setTimeout(() => inp.focus(), 50);
        };
        sendBtn.onclick = doSend;
        inp.onkeydown = (e) => { if (e.key === "Enter") doSend(); };
        inp.onfocus = () => { scrollBottom(70); };
        inp.onblur = () => { setTimeout(() => {}, 120); };

        inputRow.appendChild(inp);
        inputRow.appendChild(sendBtn);
        footerTop.appendChild(modelSel);
        footer.appendChild(errEl);
        footer.appendChild(footerTop);
        footer.appendChild(inputRow);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        ctxDocument.body.appendChild(overlay);
        setTimeout(() => inp.focus(), 100);

        const vk = typeof navigator !== "undefined" && navigator.virtualKeyboard ? navigator.virtualKeyboard : null;
        if (vk) {
            try { vk.overlaysContent = true; } catch (_) {}
        }
        const syncViewport = () => {
            if (!ctxDocument.body.contains(overlay)) return;
            const mobile = isMobile();
            if (!mobile) {
                overlay.style.top = "";
                overlay.style.bottom = "";
                overlay.style.height = "";
                overlay.style.paddingTop = "";
                overlay.style.paddingBottom = "";
                modal.style.height = "";
                modal.style.maxHeight = "";
                modal.style.paddingBottom = "";
                footer.style.position = "";
                footer.style.bottom = "";
                scrollBottom(60);
                return;
            }
            const vv = ctxWindow.visualViewport || null;
            const viewportTop = vv && Number.isFinite(vv.offsetTop) ? Math.max(0, Math.floor(vv.offsetTop)) : 0;
            const viewportHeight = vv && Number.isFinite(vv.height) ? Math.max(180, Math.floor(vv.height)) : ctxWindow.innerHeight;
            overlay.style.top = `${viewportTop}px`;
            overlay.style.bottom = "auto";
            overlay.style.height = `${viewportHeight}px`;
            overlay.style.paddingTop = "max(8px, env(safe-area-inset-top, 0px))";
            overlay.style.paddingBottom = "calc(env(safe-area-inset-bottom, 0px) + 0px)";
            modal.style.height = "100%";
            modal.style.maxHeight = "100%";
            modal.style.paddingBottom = "";
            footer.style.position = "";
            footer.style.bottom = "";
            scrollBottom(60);
        };
        const scheduleViewportSync = () => {
            syncViewport();
            setTimeout(syncViewport, 90);
            setTimeout(syncViewport, 260);
            setTimeout(syncViewport, 520);
        };
        scheduleViewportSync();
        if (ctxWindow.visualViewport) {
            const onVV = () => scheduleViewportSync();
            ctxWindow.visualViewport.addEventListener("resize", onVV);
            ctxWindow.visualViewport.addEventListener("scroll", onVV);
            addCleanup(() => {
                try { ctxWindow.visualViewport.removeEventListener("resize", onVV); } catch (_) {}
                try { ctxWindow.visualViewport.removeEventListener("scroll", onVV); } catch (_) {}
            });
        }
        if (vk && typeof vk.addEventListener === "function") {
            const onVk = () => scheduleViewportSync();
            vk.addEventListener("geometrychange", onVk);
            addCleanup(() => {
                try { vk.removeEventListener("geometrychange", onVk); } catch (_) {}
            });
        }
        const onOrient = () => scheduleViewportSync();
        ctxWindow.addEventListener("orientationchange", onOrient, { passive: true });
        addCleanup(() => {
            try { ctxWindow.removeEventListener("orientationchange", onOrient, { passive: true }); } catch (_) {}
        });
    };

    return {
        ...await loadCore(),
        buildAiPanel,
        openPatientChatModal
    };
}
