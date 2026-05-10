const CHAT_STYLE_ID = "pf-patient-chat-modal-style";

const CHAT_STYLE_TEXT = `
            .ai-chat-open-btn { display:flex; align-items:center; gap:12px; flex:1 1 0; min-width:0; background:var(--background-primary-alt); border:1px solid var(--background-modifier-border); border-radius:12px; padding:0 18px; height:52px; cursor:pointer; transition:all 0.2s; font-family:var(--font-interface); color:var(--text-normal); box-sizing:border-box; line-height:1; }
            .ai-chat-open-btn:hover { border-color:#6200ea; background:var(--background-modifier-hover); box-shadow:0 0 0 3px rgba(98,0,234,0.12); }
            .ai-chat-open-icon { font-size:18px; flex-shrink:0; display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; background:rgba(98,0,234,0.12); line-height:1; }
            .ai-chat-open-label { font-size:14px; font-weight:600; flex:1; text-align:left; line-height:1; background:linear-gradient(90deg,#6200ea,#b388ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
            .ai-chat-open-arrow { color:var(--text-muted); font-size:15px; flex-shrink:0; transition:transform 0.2s; display:flex; align-items:center; line-height:1; }
            .ai-chat-open-btn:hover .ai-chat-open-arrow { transform:translateX(4px); color:#6200ea; }
            .ai-chat-overlay { overflow:hidden; padding-top:max(8px, env(safe-area-inset-top, 0px)); box-sizing:border-box; height:100dvh; }
            .ai-chat-modal { display:flex; flex-direction:column; flex:1 1 auto; min-height:0; max-height:100%; }
            .ai-chat-header { padding:14px 16px 12px; gap:10px; cursor:default; }
            .ai-chat-header-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }
            .ai-chat-head-btn { width:34px; height:34px; border-radius:50%; border:none; flex-shrink:0; display:flex; align-items:center; justify-content:center; cursor:pointer; background:var(--background-modifier-border); color:var(--text-muted); transition:all 0.2s; }
            .ai-chat-head-btn:hover { background:rgba(98,0,234,0.14); color:#6200ea; }
            .ai-chat-close-btn:hover { background:rgba(229,57,53,0.18); color:#e53935; }
            .ai-chat-title-text { min-width:0; }
            .ai-chat-hist { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding:16px 20px; }
            .ai-msg-u { align-self:flex-end; max-width:85%; background:linear-gradient(135deg,#6200ea,#9c27b0); color:#fff; border-radius:14px 14px 0 14px; padding:10px 14px; font-size:13px; line-height:1.4; box-shadow:0 4px 12px rgba(98,0,234,0.25); word-break:break-word; }
            .ai-msg-a { align-self:flex-start; max-width:85%; background:var(--background-secondary); border:1px solid var(--background-modifier-border); color:var(--text-normal); border-radius:14px 14px 14px 0; padding:12px 16px; font-size:13px; line-height:1.5; box-shadow:0 4px 12px rgba(0,0,0,0.05); word-break:break-word; }
            .ai-msg-a pre, .ai-msg-a table { max-width:100%; overflow-x:auto; display:block; }
            .ai-msg-a code { word-break:break-word; white-space:pre-wrap; }
            .ai-msg-a p:last-child, .ai-msg-u p:last-child { margin-bottom:0; }
            .ai-chat-footer { flex-shrink:0; display:flex; flex-direction:column; gap:8px; padding:0 16px calc(env(safe-area-inset-bottom, 0px) + 14px); background:linear-gradient(180deg, rgba(0,0,0,0) 0%, color-mix(in srgb, var(--background-primary-alt) 92%, transparent) 22%); }
            .ai-chat-footer-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
            .ai-chat-model-select { height:32px; min-width:0; max-width:220px; padding:0 8px; border-radius:8px; border:1px solid var(--background-modifier-border); background:var(--background-primary); color:var(--text-muted); font-size:12px; cursor:pointer; outline:none; }
            .ai-chat-error { font-size:12px; display:none; font-weight:600; padding:7px 10px; border-radius:10px; background:rgba(244,67,54,0.1); flex-shrink:0; }
            .ai-chat-inp-wrap { display:flex; align-items:center; gap:8px; background:var(--background-secondary); padding:8px 10px; border-radius:12px; border:1px solid var(--background-modifier-border); transition:all 0.2s; flex-shrink:0; margin:0; }
            .ai-chat-inp-wrap:focus-within { border-color:#6200ea; box-shadow:0 0 0 2px rgba(98,0,234,0.15); background:var(--background-primary); }
            .ai-chat-inp { flex:1; border:none; background:transparent; font-size:14px; outline:none; color:var(--text-normal); padding:4px; min-width:0; }
            .ai-send-btn { width:36px; height:36px; border-radius:10px; background:#6200ea; color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; transition:transform 0.1s, opacity 0.2s; box-shadow:0 2px 8px rgba(98,0,234,0.4); flex-shrink:0; }
            .ai-send-btn:active { transform:scale(0.92); }
            .ai-send-btn[disabled] { opacity:0.5; cursor:not-allowed; }
            @keyframes ai-pulse { 0%,100%{opacity:0.4;transform:translateY(0);} 50%{opacity:1;transform:translateY(-3px);} }
            .ai-typing { display:flex; align-items:center; gap:4px; padding:10px 16px; background:var(--background-secondary); border-radius:14px 14px 14px 0; align-self:flex-start; }
            .ai-typing span { display:inline-block; width:6px; height:6px; background:#6200ea; border-radius:50%; animation:ai-pulse 0.8s infinite; }
            .ai-typing span:nth-child(2){animation-delay:0.15s;} .ai-typing span:nth-child(3){animation-delay:0.3s;}
            .ai-scan-context-info { font-size:11px; color:#4caf50; display:flex; align-items:center; gap:6px; padding:0 20px 4px; flex-shrink:0; opacity:0.9; }
            @media (max-width: 640px) {
                .ai-chat-open-btn { flex: none; width: 100%; }
                .ai-chat-modal { border-radius:18px 18px 0 0; height:100%; }
                .ai-chat-header { padding:12px 14px 10px; }
                .ai-chat-title-text { font-size:15px; }
                .ai-chat-header-right { gap:4px; }
                .ai-chat-head-btn { width:36px; height:36px; }
                .ai-chat-hist { padding:12px 14px; gap:10px; }
                .ai-msg-u, .ai-msg-a { max-width:92%; font-size:13px; }
                .ai-chat-footer { padding:0 12px calc(env(safe-area-inset-bottom, 0px) + 10px); gap:6px; }
                .ai-chat-footer-top { flex-wrap:wrap; align-items:stretch; gap:6px; }
                .ai-chat-model-select { width:100%; max-width:none; height:34px; font-size:12px; }
                .ai-chat-inp-wrap { padding:7px 8px; gap:6px; border-radius:14px; }
                .ai-chat-inp { font-size:16px; padding:6px 4px; }
                .ai-send-btn { width:40px; height:40px; border-radius:12px; }
                .ai-scan-context-info { padding:0 14px 6px; }
            }
            @media (max-width: 380px) {
                .ai-chat-header { padding:10px 12px 8px; }
                .ai-chat-hist { padding:10px 12px; }
                .ai-chat-footer { padding:0 10px calc(env(safe-area-inset-bottom, 0px) + 8px); }
            }
        `;

function ensurePatientChatStyles(doc) {
    if (!doc || !doc.head || typeof doc.createElement !== "function") return false;
    if (typeof doc.getElementById === "function" && doc.getElementById(CHAT_STYLE_ID)) return false;
    const style = doc.createElement("style");
    style.id = CHAT_STYLE_ID;
    style.textContent = CHAT_STYLE_TEXT;
    doc.head.appendChild(style);
    return true;
}

module.exports = {
    CHAT_STYLE_ID,
    CHAT_STYLE_TEXT,
    ensurePatientChatStyles
};
