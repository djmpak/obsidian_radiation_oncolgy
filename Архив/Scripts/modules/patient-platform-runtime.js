async ({ platform, app, Notice: NoticeCtor = globalThis.Notice }) => {
    if (!platform) throw new Error("Patient platform adapter is required");
    const notice = (message) => {
        if (!NoticeCtor) throw new Error("Notice API is unavailable");
        return new NoticeCtor(message);
    };

    const openFileByPath = async (path, fallbackNotice = null) => {
        const result = await platform.openFileByPath(path);
        if (!result?.ok && fallbackNotice) {
            notice(fallbackNotice);
        }
        return result;
    };

    return {
        ui: {
            notice,
            openFileByPath,
            getFile: (path) => platform.getFile(path),
            openLinkText: (path, sourcePath = "") => app.workspace.openLinkText(path, sourcePath)
        }
    };
}
