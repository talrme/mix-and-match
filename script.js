(function () {
    "use strict";

    const POINTER_MOVE_OPTS = { passive: false };

    const ERASER_CURSOR =
        'url("data:image/svg+xml,' +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">' +
                '<path fill="#ffb8d9" stroke="#c2186e" stroke-width="1.4" d="M8 23 L12 9 L18 7 L23 11 L15 23 Z"/>' +
                '<path fill="#e9ecef" stroke="#868e96" stroke-width="1.1" d="M5 21 L11 24 L8 27 L4 24 Z"/>' +
                "</svg>"
        ) +
        '") 15 22, crosshair';

    const SWATCHES = [
        "#ff6b9d", "#7c5cff", "#00c9ff", "#43e97b", "#ffd93d", "#ff9f43",
        "#ee5a6f", "#5f27cd", "#ffffff", "#2d3436"
    ];

    const SETTINGS_STORAGE_KEY = "miris-mix-and-match:settings:v1";
    const PROJECT_DB_NAME = "miris-mix-and-match-projects";
    const PROJECT_DB_VERSION = 1;
    const PROJECT_STORE_NAME = "projects";
    const AUTOSAVE_PROJECT_ID = "__autosave__";
    const AUTOSAVE_DELAY_MS = 700;
    const VALID_THEMES = new Set(["candy", "ocean", "forest", "sunset"]);
    const DEFAULT_APP_SETTINGS = Object.freeze({
        theme: "candy",
        sound: false,
        includeDoodlesInLinks: true,
        twoFingerGestures: true
    });
    let appSettings = loadAppSettings();
    let projectDbPromise = null;
    let autosaveTimer = null;
    let autosaveEnabled = false;

    const BUILTIN = {
        star: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ffd93d" stroke="#f39c12" stroke-width="4" d="M50 8l12 28 30 2-23 20 7 30-26-16-26 16 7-30-23-20 30-2z"/></svg>'
        ),
        heart: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ff6b9d" stroke="#c0392b" stroke-width="3" d="M50 88S12 58 12 38c0-14 11-25 25-25 8 0 15 4 19 10 4-6 11-10 19-10 14 0 25 11 25 25 0 20-38 50-38 50z"/></svg>'
        ),
        smile: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#ffe066" stroke="#f39c12" stroke-width="4"/><circle cx="36" cy="42" r="6" fill="#2d3436"/><circle cx="64" cy="42" r="6" fill="#2d3436"/><path fill="none" stroke="#2d3436" stroke-width="5" stroke-linecap="round" d="M32 62c8 14 28 14 36 0"/></svg>'
        ),
        flower: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="12" fill="#ffe066"/><g fill="#ff6b9d"><circle cx="50" cy="22" r="14"/><circle cx="50" cy="78" r="14"/><circle cx="22" cy="50" r="14"/><circle cx="78" cy="50" r="14"/></g></svg>'
        ),
        ball: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#7c5cff" stroke="#4834a4" stroke-width="4"/><circle cx="38" cy="38" r="12" fill="#fff" opacity="0.35"/></svg>'
        ),
        rainbow: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ff6b9d"/><stop offset="0.33" stop-color="#ffd93d"/><stop offset="0.66" stop-color="#6bcf7f"/><stop offset="1" stop-color="#4dabf7"/></linearGradient></defs><path fill="url(#g)" stroke="#fff" stroke-width="3" d="M10 65 Q60 5 110 65 Z"/></svg>'
        ),
        grass: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect fill="#87ceeb" width="200" height="120"/><rect y="70" height="50" width="200" fill="#6bcf7f"/><circle cx="160" cy="35" r="22" fill="#fff" opacity="0.9"/><circle cx="175" cy="40" r="18" fill="#fff" opacity="0.85"/></svg>'
        ),
        night: "data:image/svg+xml," + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect fill="#2d1b69" width="200" height="120"/><circle cx="150" cy="35" r="18" fill="#ffe066"/><circle cx="40" cy="25" r="2" fill="#fff"/><circle cx="70" cy="18" r="1.5" fill="#fff"/><circle cx="90" cy="40" r="1" fill="#fff"/></svg>'
        )
    };

    const DEFAULT_MANIFEST = {
        stopAfterMisses: 10,
        numberPadding: 3,
        sections: [
            {
                id: "people",
                label: "People",
                kind: "sticker",
                folder: "assets/people/",
                items: []
            },
            {
                id: "outfits",
                label: "Outfits",
                kind: "sticker",
                folder: "assets/outfits/",
                items: []
            },
            {
                id: "extras",
                label: "Extras",
                kind: "sticker",
                folder: "assets/extras/",
                items: []
            },
            {
                id: "backgrounds",
                label: "Backgrounds",
                kind: "background",
                folder: "assets/backgrounds/",
                items: []
            },
            { id: "paint", label: "Doodle", kind: "paint", items: [] },
            { id: "text", label: "Words", kind: "text", items: [] }
        ]
    };

    const TEXT_FONTS = [
        { id: "fredoka", family: '"Fredoka", system-ui, sans-serif', label: "Round & friendly" },
        { id: "bungee", family: '"Bungee", cursive', label: "Big & poppy" },
        { id: "caveat", family: '"Caveat", cursive', label: "Swishy handwriting" }
    ];

    let manifest = DEFAULT_MANIFEST;
    let nextId = 1;
    let backgroundSrc = null;
    let items = [];
    let selectedId = null;
    const dupOffsets = new Map();
    let paintToolActive = false;
    let paintLayerRank = 0;
    const DOODLES_LAYER_ID = "__DOODLES__";
    const BACKGROUND_LAYER_ID = "__BACKGROUND__";

    let paintHasContent = false;
    let paintRainbow = false;

    /** First real doodles in a fresh scene: tuck stickers under paint; new stickers still pop above via z + clamp. */
    let pendingDoodleStackBoost = true;

    const past = [];
    const future = [];
    const MAX_HISTORY = 28;

    let paintColor = SWATCHES[0];
    let paintSize = 18;
    let penType = "round";
    let isEraser = false;
    let painting = false;
    let lastPaint = null;
    let lastPearl = null;
    /** @type {{ points: { nx: number; ny: number }[]; rainbow: boolean; color: string; lineWidth: number }[]} */
    let antsPaths = [];
    /** @type {{ nx: number; ny: number }[] | null} */
    let antsDraftPoints = null;
    let antsRaf = null;

    const els = {};
    let stageRect = null;
    let trashRect = null;
    let layerRowEls = new Map();

    let layerDrag = null;
    let layerEdgeScrollRaf = null;

    function cancelLayerEdgeScroll() {
        if (layerEdgeScrollRaf != null) {
            cancelAnimationFrame(layerEdgeScrollRaf);
            layerEdgeScrollRaf = null;
        }
    }

    /** insert before row k; k === n means after last sticker row */
    function insertBeforeIndexFromPointer(clientY) {
        if (!layerDrag) return 0;
        const list = layerDrag.listEl;
        const y = clientY - list.getBoundingClientRect().top + list.scrollTop;
        const rows = [...list.querySelectorAll(".layer-row:not(.layer-bg-row)")];
        const n = rows.length;
        if (!n) return 0;
        for (let i = 0; i < n; i++) {
            const mid = rows[i].offsetTop + rows[i].offsetHeight / 2;
            if (y < mid) return i;
        }
        return n;
    }

    function positionLayerDropIndicator(insertBefore) {
        if (!layerDrag || !layerDrag.dropLineEl) return;
        const list = layerDrag.listEl;
        const line = layerDrag.dropLineEl;
        const rows = [...list.querySelectorAll(".layer-row:not(.layer-bg-row)")];
        const n = rows.length;
        let topPx = 0;
        if (n === 0) {
            topPx = 0;
        } else if (insertBefore <= 0) {
            topPx = rows[0].offsetTop;
        } else if (insertBefore >= n) {
            const last = rows[n - 1];
            const mb = parseFloat(getComputedStyle(last).marginBottom) || 0;
            topPx = last.offsetTop + last.offsetHeight + mb;
        } else {
            topPx = rows[insertBefore].offsetTop;
        }
        line.style.top = topPx + "px";
    }

    function updateLayerDropUi(clientY) {
        if (!layerDrag) return;
        const ib = insertBeforeIndexFromPointer(clientY);
        layerDrag.insertBefore = ib;
        positionLayerDropIndicator(ib);
    }

    function captureLayerRowRects() {
        const list = $("layers-list");
        const m = new Map();
        if (!list) return m;
        list.querySelectorAll(".layer-row:not(.layer-bg-row)").forEach((r) => {
            m.set(r.dataset.id, r.getBoundingClientRect());
        });
        return m;
    }

    function animateLayerRowsFlip(prevRects) {
        const list = $("layers-list");
        if (!list || prevRects.size === 0) return;
        const rows = [...list.querySelectorAll(".layer-row:not(.layer-bg-row)")];
        rows.forEach((r) => {
            const prev = prevRects.get(r.dataset.id);
            if (!prev) return;
            const neu = r.getBoundingClientRect();
            const dy = prev.top - neu.top;
            if (Math.abs(dy) < 0.5) return;
            r.style.transition = "none";
            r.style.transform = "translateY(" + dy + "px)";
        });
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rows.forEach((r) => {
                    if (!prevRects.has(r.dataset.id)) return;
                    r.style.transition =
                        "transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)";
                    r.style.transform = "";
                });
                window.setTimeout(() => {
                    rows.forEach((r) => {
                        r.style.transition = "";
                        r.style.transform = "";
                    });
                }, 340);
            });
        });
    }

    function autoScrollLayersForDrag(clientY) {
        if (!layerDrag) return false;
        const el = layerDrag.listEl;
        const r = el.getBoundingClientRect();
        const zone = 72;
        const maxStep = 32;
        let step = 0;
        if (clientY < r.top + zone) {
            const k = Math.min(1, (r.top + zone - clientY) / zone);
            step = -Math.max(5, Math.round(maxStep * k));
        } else if (clientY > r.bottom - zone) {
            const k = Math.min(1, (clientY - (r.bottom - zone)) / zone);
            step = Math.max(5, Math.round(maxStep * k));
        }
        if (step !== 0) {
            const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
            el.scrollTop = Math.max(0, Math.min(maxScroll, el.scrollTop + step));
            return true;
        }
        return false;
    }

    function layerEdgeScrollTick() {
        layerEdgeScrollRaf = null;
        if (!layerDrag) return;
        const y = layerDrag.lastClientY;
        autoScrollLayersForDrag(y);
        updateLayerDropUi(y);
        const el = layerDrag.listEl;
        const r = el.getBoundingClientRect();
        const zone = 72;
        const nearEdge = y < r.top + zone || y > r.bottom - zone;
        if (nearEdge && el.scrollHeight > el.clientHeight + 2) {
            layerEdgeScrollRaf = requestAnimationFrame(layerEdgeScrollTick);
        }
    }

    function scheduleLayerEdgeScrollIfNeeded(clientY) {
        if (!layerDrag || layerEdgeScrollRaf != null) return;
        const el = layerDrag.listEl;
        if (el.scrollHeight <= el.clientHeight + 2) return;
        const r = el.getBoundingClientRect();
        const zone = 72;
        if (clientY < r.top + zone || clientY > r.bottom - zone) {
            layerEdgeScrollRaf = requestAnimationFrame(layerEdgeScrollTick);
        }
    }

    function $(id) {
        return document.getElementById(id);
    }

    function loadAppSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
            return {
                ...DEFAULT_APP_SETTINGS,
                ...saved,
                theme: VALID_THEMES.has(saved.theme) ? saved.theme : DEFAULT_APP_SETTINGS.theme,
                sound: saved.sound === true,
                includeDoodlesInLinks: saved.includeDoodlesInLinks !== false,
                twoFingerGestures: saved.twoFingerGestures !== false
            };
        } catch (_) {
            return { ...DEFAULT_APP_SETTINGS };
        }
    }

    function saveAppSettings() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
        } catch (_) {
            // Preferences still work for this visit if browser storage is unavailable.
        }
    }

    function applyAppSettings() {
        document.documentElement.setAttribute("data-theme", appSettings.theme);
        if ($("setting-theme")) $("setting-theme").value = appSettings.theme;
        if ($("setting-sound")) $("setting-sound").checked = appSettings.sound;
        if ($("setting-url-paint")) {
            $("setting-url-paint").checked = appSettings.includeDoodlesInLinks;
        }
        if ($("setting-two-finger")) {
            $("setting-two-finger").checked = appSettings.twoFingerGestures;
        }
    }

    function updateAppSetting(key, value) {
        appSettings = { ...appSettings, [key]: value };
        saveAppSettings();
        applyAppSettings();
        if (key === "theme") scheduleAutosave();
    }

    function applySceneTheme(theme) {
        const nextTheme = VALID_THEMES.has(theme) ? theme : DEFAULT_APP_SETTINGS.theme;
        appSettings = { ...appSettings, theme: nextTheme };
        saveAppSettings();
        applyAppSettings();
    }

    function openProjectDb() {
        if (projectDbPromise) return projectDbPromise;
        projectDbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("Local project storage is unavailable."));
                return;
            }
            const request = indexedDB.open(PROJECT_DB_NAME, PROJECT_DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
                    db.createObjectStore(PROJECT_STORE_NAME, { keyPath: "id" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Could not open local storage."));
            request.onblocked = () => reject(new Error("Local storage is busy in another tab."));
        });
        projectDbPromise.catch(() => {
            projectDbPromise = null;
        });
        return projectDbPromise;
    }

    async function putLocalProject(project) {
        const db = await openProjectDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PROJECT_STORE_NAME, "readwrite");
            tx.objectStore(PROJECT_STORE_NAME).put(project);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error("Could not save the picture."));
            tx.onabort = () => reject(tx.error || new Error("Picture saving was interrupted."));
        });
    }

    async function getLocalProject(id) {
        const db = await openProjectDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(PROJECT_STORE_NAME, "readonly")
                .objectStore(PROJECT_STORE_NAME)
                .get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error("Could not open the picture."));
        });
    }

    async function listNamedProjects() {
        const db = await openProjectDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(PROJECT_STORE_NAME, "readonly")
                .objectStore(PROJECT_STORE_NAME)
                .getAll();
            request.onsuccess = () => {
                const projects = (request.result || [])
                    .filter((project) => project.id !== AUTOSAVE_PROJECT_ID)
                    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                resolve(projects);
            };
            request.onerror = () => reject(request.error || new Error("Could not list saved pictures."));
        });
    }

    async function deleteLocalProject(id) {
        const db = await openProjectDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PROJECT_STORE_NAME, "readwrite");
            tx.objectStore(PROJECT_STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error("Could not delete the picture."));
            tx.onabort = () => reject(tx.error || new Error("Picture deletion was interrupted."));
        });
    }

    function scheduleAutosave(delayMs) {
        if (!autosaveEnabled) return;
        if (autosaveTimer != null) window.clearTimeout(autosaveTimer);
        autosaveTimer = window.setTimeout(() => {
            autosaveTimer = null;
            saveAutosave().catch(() => {});
        }, delayMs == null ? AUTOSAVE_DELAY_MS : delayMs);
    }

    async function saveAutosave() {
        if (!autosaveEnabled) return;
        const scene = serializeForUrl(true);
        await putLocalProject({
            id: AUTOSAVE_PROJECT_ID,
            name: "Current picture",
            updatedAt: Date.now(),
            scene
        });
    }

    async function flushAutosave() {
        if (autosaveTimer != null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        await saveAutosave();
    }

    async function restoreAutosave() {
        try {
            const saved = await getLocalProject(AUTOSAVE_PROJECT_ID);
            return !!(saved && saved.scene && applyFromSerialized(saved.scene));
        } catch (_) {
            return false;
        }
    }

    function projectIdForName(name) {
        const normalized = name.normalize("NFKC").trim().toLocaleLowerCase();
        let hash = 2166136261;
        for (let i = 0; i < normalized.length; i++) {
            hash ^= normalized.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return "saved:" + (hash >>> 0).toString(36);
    }

    function setProjectStatus(message, isError) {
        const status = $("project-status");
        if (!status) return;
        status.textContent = message || "";
        status.classList.toggle("is-error", !!isError);
    }

    function loadThumbnailImage(src) {
        return new Promise((resolve) => {
            if (!src) {
                resolve(null);
                return;
            }
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = src;
        });
    }

    function drawImageCover(ctx, image, width, height) {
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function drawThumbnailText(ctx, item, width, height) {
        const scale = Number.isFinite(Number(item.scale)) ? Number(item.scale) : 1;
        const boxWidth = Math.max(44, (item.baseW || 0.44) * width * scale);
        const fontSize = Math.max(10, Math.min(26, width * 0.065 * scale));
        const lines = String(item.text || "Text").split(/\n/).slice(0, 3);
        const lineHeight = fontSize * 1.12;
        const boxHeight = Math.max(lineHeight + 10, lines.length * lineHeight + 10);

        ctx.save();
        ctx.translate(
            (item.nx != null ? item.nx : 0.5) * width,
            (item.ny != null ? item.ny : 0.5) * height
        );
        ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        if (!item.textBorderless) {
            ctx.fillStyle = "rgba(255,255,255,0.86)";
            ctx.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
        }
        ctx.fillStyle = item.textRainbow ? "#7c5cff" : item.textColor || "#2d3436";
        ctx.font = "700 " + fontSize + "px Fredoka, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        lines.forEach((line, index) => {
            const y = (index - (lines.length - 1) / 2) * lineHeight;
            ctx.fillText(line.slice(0, 34), 0, y, boxWidth - 8);
        });
        ctx.restore();
    }

    function drawThumbnailSticker(ctx, item, image, width, height) {
        if (item.kind === "text") {
            drawThumbnailText(ctx, item, width, height);
            return;
        }
        if (!image) return;
        const scale = Number.isFinite(Number(item.scale)) ? Number(item.scale) : 1;
        const drawWidth = Math.max(12, (item.baseW || 0.22) * width * scale);
        const ratio = image.naturalHeight / Math.max(1, image.naturalWidth);
        const drawHeight = drawWidth * ratio;
        ctx.save();
        ctx.translate(
            (item.nx != null ? item.nx : 0.5) * width,
            (item.ny != null ? item.ny : 0.5) * height
        );
        ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
    }

    function drawThumbnailAnts(ctx, ants, width, height) {
        if (!Array.isArray(ants)) return;
        ctx.save();
        ctx.lineCap = "round";
        ants.forEach((path) => {
            const points = Array.isArray(path.points) ? path.points : [];
            if (points.length < 2) return;
            ctx.beginPath();
            points.forEach((point, index) => {
                const x = point.nx * width;
                const y = point.ny * height;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = path.rainbow ? "#7c5cff" : path.color || "#2d3436";
            ctx.lineWidth = Math.max(1, (path.lineWidth || 3) * (width / 1024));
            ctx.setLineDash([3, 3]);
            ctx.stroke();
        });
        ctx.restore();
    }

    async function createProjectThumbnail(scene) {
        const width = 320;
        const height = 240;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue("--canvas-bg")
            .trim() || "#fffef8";
        ctx.fillRect(0, 0, width, height);

        const sceneItems = Array.isArray(scene.items) ? scene.items : [];
        const sources = [...new Set([scene.bg, ...sceneItems.map((item) => item.src)].filter(Boolean))];
        const loaded = await Promise.all(sources.map(async (src) => [src, await loadThumbnailImage(src)]));
        const images = new Map(loaded);
        const background = images.get(scene.bg);
        if (background) drawImageCover(ctx, background, width, height);

        const sorted = sceneItems.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
        const rank = Math.max(0, Math.min(sorted.length, scene.paintLayerRank || 0));
        sorted.slice(0, rank).forEach((item) => {
            drawThumbnailSticker(ctx, item, images.get(item.src), width, height);
        });

        if (scene.paint) {
            const paint = await loadThumbnailImage(scene.paint);
            if (paint) ctx.drawImage(paint, 0, 0, width, height);
        }
        drawThumbnailAnts(ctx, scene.ants, width, height);

        sorted.slice(rank).forEach((item) => {
            drawThumbnailSticker(ctx, item, images.get(item.src), width, height);
        });
        return canvas.toDataURL("image/jpeg", 0.8);
    }

    function formatProjectDate(timestamp) {
        try {
            return new Intl.DateTimeFormat([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }).format(new Date(timestamp));
        } catch (_) {
            return "Saved picture";
        }
    }

    async function refreshProjectGallery() {
        const gallery = $("project-gallery");
        if (!gallery) return;
        try {
            const projects = await listNamedProjects();
            gallery.innerHTML = "";
            if (!projects.length) {
                const empty = document.createElement("p");
                empty.className = "project-gallery-empty";
                empty.textContent = "Named pictures you save will appear here.";
                gallery.appendChild(empty);
                return;
            }

            projects.forEach((project) => {
                const card = document.createElement("article");
                card.className = "project-card";

                const thumb = document.createElement("img");
                thumb.className = "project-card-thumb";
                thumb.src = project.thumbnail || "assets/icons/app-icon-192.png";
                thumb.alt = "Preview of " + project.name;
                card.appendChild(thumb);

                const body = document.createElement("div");
                body.className = "project-card-body";

                const name = document.createElement("h4");
                name.className = "project-card-name";
                name.textContent = project.name;
                body.appendChild(name);

                const date = document.createElement("p");
                date.className = "project-card-date";
                date.textContent = formatProjectDate(project.updatedAt);
                body.appendChild(date);

                const actions = document.createElement("div");
                actions.className = "project-card-actions";

                const open = document.createElement("button");
                open.type = "button";
                open.className = "btn btn-project-action";
                open.dataset.projectAction = "open";
                open.dataset.projectId = project.id;
                open.textContent = "Open";
                actions.appendChild(open);

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "btn btn-project-action btn-project-delete";
                remove.dataset.projectAction = "delete";
                remove.dataset.projectId = project.id;
                remove.dataset.projectName = project.name;
                remove.setAttribute("aria-label", "Delete " + project.name);
                remove.title = "Delete picture";
                remove.textContent = "🗑️";
                actions.appendChild(remove);

                body.appendChild(actions);
                card.appendChild(body);
                gallery.appendChild(card);
            });
        } catch (_) {
            gallery.innerHTML = "";
            const unavailable = document.createElement("p");
            unavailable.className = "project-gallery-empty";
            unavailable.textContent = "Local picture storage is unavailable in this browser.";
            gallery.appendChild(unavailable);
        }
    }

    async function saveNamedProject() {
        const button = $("btn-save-project");
        const input = $("project-name");
        if (!button || !input || button.disabled) return;
        button.disabled = true;
        setProjectStatus("Saving…");
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
        }
        try {
            const projects = await listNamedProjects();
            const name = input.value.trim() || "Picture " + (projects.length + 1);
            input.value = name;
            const scene = serializeForUrl(true);
            const thumbnail = await createProjectThumbnail(scene);
            await putLocalProject({
                id: projectIdForName(name),
                name,
                updatedAt: Date.now(),
                scene,
                thumbnail
            });
            await refreshProjectGallery();
            setProjectStatus('Saved “' + name + '” on this device.');
            scheduleAutosave(0);
            playBeep(true);
        } catch (_) {
            setProjectStatus("This picture could not be saved on this device.", true);
        } finally {
            button.disabled = false;
        }
    }

    async function handleProjectGalleryClick(event) {
        const button = event.target.closest("[data-project-action]");
        if (!button) return;
        const id = button.dataset.projectId;
        if (!id) return;

        if (button.dataset.projectAction === "open") {
            button.disabled = true;
            try {
                await flushAutosave();
                const project = await getLocalProject(id);
                if (!project || !project.scene || !applyFromSerialized(project.scene)) {
                    throw new Error("Invalid project");
                }
                $("project-name").value = project.name;
                $("settings-modal").classList.add("hidden");
                setProjectStatus('Opened “' + project.name + '”.');
                playBeep(true);
            } catch (_) {
                setProjectStatus("That picture could not be opened.", true);
            } finally {
                button.disabled = false;
            }
            return;
        }

        if (button.dataset.projectAction === "delete") {
            const name = button.dataset.projectName || "this picture";
            if (!confirm('Delete “' + name + '” from this device?')) return;
            button.disabled = true;
            try {
                await deleteLocalProject(id);
                await refreshProjectGallery();
                setProjectStatus('Deleted “' + name + '”.');
            } catch (_) {
                setProjectStatus("That picture could not be deleted.", true);
                button.disabled = false;
            }
        }
    }

    function bindLocalProjects() {
        $("btn-save-project").addEventListener("click", saveNamedProject);
        $("project-name").addEventListener("keydown", (event) => {
            if (event.key === "Enter") saveNamedProject();
        });
        $("project-gallery").addEventListener("click", handleProjectGalleryClick);
    }

    function uid() {
        return "L" + nextId++;
    }

    function playBeep(high) {
        if (!appSettings.sound) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.value = high ? 520 : 320;
            g.gain.value = 0.08;
            o.start();
            o.stop(ctx.currentTime + 0.06);
            setTimeout(() => ctx.close(), 200);
        } catch (_) {}
    }

    function stageBox() {
        const st = $("canvas-stage");
        return st.getBoundingClientRect();
    }

    function syncRects() {
        stageRect = stageBox();
        trashRect = $("trash-zone").getBoundingClientRect();
    }

    function normFromClient(clientX, clientY) {
        const r = stageRect || stageBox();
        return {
            nx: (clientX - r.left) / r.width,
            ny: (clientY - r.top) / r.height
        };
    }

    function probeImage(src) {
        return new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve(true);
            im.onerror = () => resolve(false);
            im.src = src;
        });
    }

    /**
     * Loads numbered files in order under `section.folder`.
     * Primary name: `section.filenameTemplate` (default "{n}.png"). Optional `section.alternateFilenameTemplates`
     * is tried when the primary URL misses (e.g. "{n}_miri.png" when every file uses the same suffix).
     * Stops after `stopAfterMisses` consecutive misses (no successful probe for that index).
     */
    async function discoverSequentialInFolder(section, pad, stopAfterMisses) {
        const folderBase = section.folder;
        const sectionId = section.id;
        const primaryTpl = section.filenameTemplate || "{n}.png";
        const altTpls = Array.isArray(section.alternateFilenameTemplates)
            ? section.alternateFilenameTemplates
            : [];
        const found = [];
        let misses = 0;
        const base = folderBase.replace(/\/?$/, "/");

        function fileNamesForIndex(i) {
            const n = String(i).padStart(pad, "0");
            const apply = (tpl) => tpl.replace(/\{n\}/g, n);
            return [apply(primaryTpl)].concat(altTpls.map(apply));
        }

        for (let i = 1; i <= 999 && misses < stopAfterMisses; i++) {
            let hit = null;
            for (const name of fileNamesForIndex(i)) {
                const url = base + name.replace(/^\//, "");
                if (await probeImage(url)) {
                    hit = { url, name };
                    break;
                }
            }
            if (hit) {
                found.push({
                    id: sectionId + "-" + i,
                    src: hit.url,
                    label: String(i).padStart(pad, "0")
                });
                misses = 0;
            } else {
                misses++;
            }
        }
        return found;
    }

    async function loadManifest() {
        try {
            const res = await fetch("assets/manifest.json", { cache: "no-store" });
            if (!res.ok) throw new Error("no manifest");
            const j = await res.json();
            manifest = Object.assign({}, DEFAULT_MANIFEST, j);
            if (!Array.isArray(manifest.sections)) manifest.sections = DEFAULT_MANIFEST.sections;
        } catch (_) {
            manifest = JSON.parse(JSON.stringify(DEFAULT_MANIFEST));
        }

        const stopMisses =
            manifest.stopAfterMisses != null ? manifest.stopAfterMisses : 10;
        const pad = manifest.numberPadding != null ? manifest.numberPadding : 3;

        for (const s of manifest.sections) {
            if (!s.items) s.items = [];
            s.items = s.items.map((it) => {
                if (it.src) return it;
                if (it.file) return Object.assign({}, it, { src: it.file });
                return it;
            });
        }

        for (const s of manifest.sections) {
            if (!s.folder) continue;
            s.items = await discoverSequentialInFolder(s, pad, stopMisses);
        }

        for (const s of manifest.sections) {
            if (s.folder) continue;
            if (s.items && s.items.length > 0) continue;
            const d = DEFAULT_MANIFEST.sections.find((x) => x.id === s.id && x.kind === s.kind);
            if (d && d.items && d.items.length) {
                s.items = JSON.parse(JSON.stringify(d.items));
            }
        }

        if (!manifest.sections.some((s) => s.kind === "text")) {
            const pi = manifest.sections.findIndex((s) => s.kind === "paint");
            const sec = { id: "text", label: "Words", kind: "text", items: [] };
            if (pi >= 0) manifest.sections.splice(pi + 1, 0, sec);
            else manifest.sections.push(sec);
        }
    }

    function setLoadingMessage(message) {
        const el = $("loading-message");
        if (el) el.textContent = message;
    }

    function preloadOneImage(src) {
        return new Promise((resolve) => {
            if (!src || src.startsWith("data:")) {
                resolve();
                return;
            }
            const image = new Image();
            image.onload = image.onerror = () => resolve();
            image.src = src;
        });
    }

    async function preloadManifestImages() {
        const sources = Array.from(
            new Set(
                manifest.sections.flatMap((section) =>
                    (section.items || []).map(resolveItemSrc).filter(Boolean)
                )
            )
        );
        if (!sources.length) return;

        let nextIndex = 0;
        let finished = 0;
        setLoadingMessage("Trying on " + sources.length + " ridiculous things…");

        async function worker() {
            while (nextIndex < sources.length) {
                const src = sources[nextIndex++];
                await preloadOneImage(src);
                finished++;
                if (finished === sources.length || finished % 8 === 0) {
                    setLoadingMessage("Stuffing the closet… " + finished + "/" + sources.length);
                }
            }
        }

        const workerCount = Math.min(8, sources.length);
        await Promise.all(Array.from({ length: workerCount }, worker));
    }

    async function finishLoadingOverlay(startedAt) {
        const overlay = $("loading-overlay");
        if (!overlay) return;
        const minimumShowTime = 650;
        const wait = Math.max(0, minimumShowTime - (performance.now() - startedAt));
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        setLoadingMessage("Fashion disaster ready!");
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        overlay.classList.add("is-finished");
        overlay.setAttribute("aria-hidden", "true");
        setTimeout(() => overlay.remove(), 400);
    }

    function resolveItemSrc(it) {
        if (it.src && it.src.startsWith("__builtin__/")) {
            const key = it.src.slice("__builtin__/".length);
            return BUILTIN[key] || it.src;
        }
        return it.src;
    }

    function capturePaint() {
        const c = $("paint-canvas");
        const ctx = c.getContext("2d");
        try {
            if (c.width && c.height) return ctx.getImageData(0, 0, c.width, c.height);
        } catch (_) {}
        return null;
    }

    function clampPaintLayerRank() {
        paintLayerRank = Math.max(0, Math.min(items.length, paintLayerRank));
    }

    function recomputePaintHasContent() {
        const c = $("paint-canvas");
        let bitmapHit = false;
        if (c && c.width && c.height) {
            try {
                const ctx = c.getContext("2d");
                const id = ctx.getImageData(0, 0, c.width, c.height);
                const d = id.data;
                const step = 16;
                for (let i = 3; i < d.length; i += step * 4) {
                    if (d[i] > 12) {
                        bitmapHit = true;
                        break;
                    }
                }
            } catch (_) {}
        }
        paintHasContent = bitmapHit || antsPaths.length > 0;
    }

    function clearPaintCanvasPixels() {
        const c = $("paint-canvas");
        const st = $("canvas-stage");
        const ctx = c.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = st.clientWidth;
        const h = st.clientHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        clearAntsOverlayPixels();
        antsPaths = [];
        antsDraftPoints = null;
        stopAntsAnimationLoop();
        recomputePaintHasContent();
    }

    function clearAntsOverlayPixels() {
        const ac = $("ants-canvas");
        if (!ac || !ac.width) return;
        ac.getContext("2d").clearRect(0, 0, ac.width, ac.height);
    }

    function stopAntsAnimationLoop() {
        if (antsRaf != null) {
            cancelAnimationFrame(antsRaf);
            antsRaf = null;
        }
    }

    function syncAntsCanvasFromPaint() {
        const pc = $("paint-canvas");
        const ac = $("ants-canvas");
        if (!pc || !ac) return;
        if (ac.width !== pc.width || ac.height !== pc.height) {
            ac.width = pc.width;
            ac.height = pc.height;
        }
        ac.style.width = pc.style.width || "";
        ac.style.height = pc.style.height || "";
    }

    function redrawAntsOverlay() {
        const ac = $("ants-canvas");
        const st = $("canvas-stage");
        if (!ac || !st || !ac.width) return;
        const ctx = ac.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = st.clientWidth;
        const h = st.clientHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ac.width, ac.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        function drawPolyline(points, rainbow, color, lineWidth, pathIdx) {
            if (!points || points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(points[0].nx * w, points[0].ny * h);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].nx * w, points[i].ny * h);
            }
            let stroke;
            if (rainbow) {
                const hue = (performance.now() * 0.07 + pathIdx * 52) % 360;
                stroke = "hsl(" + hue + ", 90%, 52%)";
            } else {
                stroke = color || "#111";
            }
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.setLineDash([7, 6]);
            ctx.lineDashOffset = -(performance.now() / 32) % 13;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
        }

        antsPaths.forEach((p, i) =>
            drawPolyline(p.points, p.rainbow, p.color, p.lineWidth || 3, i)
        );
        if (antsDraftPoints && antsDraftPoints.length >= 2) {
            drawPolyline(
                antsDraftPoints,
                paintRainbow,
                paintColor,
                Math.max(2, paintSize * 0.45),
                antsPaths.length
            );
        }
    }

    function ensureAntsAnimationLoop() {
        const needs =
            antsPaths.length > 0 || (painting && penType === "ants");
        if (!needs) {
            stopAntsAnimationLoop();
            redrawAntsOverlay();
            return;
        }
        if (antsRaf != null) return;
        const loop = () => {
            redrawAntsOverlay();
            const still =
                antsPaths.length > 0 || (painting && penType === "ants");
            if (!still) {
                antsRaf = null;
                return;
            }
            antsRaf = requestAnimationFrame(loop);
        };
        antsRaf = requestAnimationFrame(loop);
    }

    function appendAntsDraftSegment(clientX0, clientY0, clientX1, clientY1) {
        if (!antsDraftPoints) return;
        const st = $("canvas-stage");
        const rect = st.getBoundingClientRect();
        const W = Math.max(1, st.clientWidth);
        const H = Math.max(1, st.clientHeight);
        const x0 = clientX0 - rect.left;
        const y0 = clientY0 - rect.top;
        const x1 = clientX1 - rect.left;
        const y1 = clientY1 - rect.top;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const dist = Math.hypot(dx, dy);
        const stepPx = Math.max(2, paintSize * 0.32);
        const steps = Math.max(1, Math.ceil(dist / stepPx));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const lx = x0 + dx * t;
            const ly = y0 + dy * t;
            const nx = lx / W;
            const ny = ly / H;
            const prev = antsDraftPoints[antsDraftPoints.length - 1];
            if (
                !prev ||
                Math.hypot((nx - prev.nx) * W, (ny - prev.ny) * H) >= stepPx * 0.35
            ) {
                antsDraftPoints.push({ nx, ny });
            }
        }
    }

    function serializeAntsForUrl() {
        return antsPaths.map((p) => ({
            p: p.points.map((pt) => [+pt.nx.toFixed(4), +pt.ny.toFixed(4)]),
            r: p.rainbow ? 1 : 0,
            c: p.color,
            w: +((p.lineWidth || 3).toFixed(2))
        }));
    }

    function antsFromSerialized(raw) {
        if (!raw || !Array.isArray(raw)) return [];
        return raw.map((x) => ({
            points: (x.p || []).map((pair) => ({ nx: pair[0], ny: pair[1] })),
            rainbow: !!x.r,
            color: x.c || "#111",
            lineWidth: x.w != null ? x.w : 3
        }));
    }

    function paintPearlDot(ctx, lx, ly, col, radius, linkPrev) {
        const alpha = paintRainbow ? 0.92 : 0.88;
        if (linkPrev && lastPearl) {
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(2, radius * 0.38);
            ctx.globalAlpha = alpha;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(lastPearl.lx, lastPearl.ly);
            ctx.lineTo(lx, ly);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(lx, ly, radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(lx, ly, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function buildPanelOrder() {
        clampPaintLayerRank();
        if (!paintHasContent) {
            const asc = items.slice().sort((a, b) => a.z - b.z);
            const frontFirst = asc.slice().reverse();
            return frontFirst.map((it) => ({ type: "sticker", id: it.id }));
        }
        const asc = items.slice().sort((a, b) => a.z - b.z);
        const below = asc.slice(0, paintLayerRank);
        const above = asc.slice(paintLayerRank);
        const frontFirstAbove = above.slice().sort((a, b) => b.z - a.z);
        const frontFirstBelow = below.slice().sort((a, b) => b.z - a.z);
        const list = [];
        frontFirstAbove.forEach((it) => list.push({ type: "sticker", id: it.id }));
        list.push({ type: "doodles" });
        frontFirstBelow.forEach((it) => list.push({ type: "sticker", id: it.id }));
        return list;
    }

    function applyPanelOrder(L) {
        const dIdx = L.findIndex((x) => x.type === "doodles");
        if (dIdx < 0) {
            let z = items.length - 1;
            for (const e of L) {
                if (e.type === "sticker") {
                    const it = items.find((x) => x.id === e.id);
                    if (it) it.z = z--;
                }
            }
            paintLayerRank = items.length;
            clampPaintLayerRank();
            return;
        }
        paintLayerRank = L.slice(dIdx + 1).filter((x) => x.type === "sticker").length;
        clampPaintLayerRank();
        let zi = items.length - 1;
        for (const e of L) {
            if (e.type === "sticker") {
                const it = items.find((x) => x.id === e.id);
                if (it) it.z = zi--;
            }
        }
    }

    function cloneState() {
        return {
            backgroundSrc,
            items: JSON.parse(JSON.stringify(items)),
            paintLayerRank,
            paint: capturePaint(),
            ants: JSON.parse(JSON.stringify(antsPaths))
        };
    }

    function applyState(snap) {
        backgroundSrc = snap.backgroundSrc;
        items = JSON.parse(JSON.stringify(snap.items));
        paintLayerRank = snap.paintLayerRank != null ? snap.paintLayerRank : 0;
        clampPaintLayerRank();
        applyBackground();
        antsPaths =
            snap.ants && Array.isArray(snap.ants)
                ? JSON.parse(JSON.stringify(snap.ants))
                : [];
        antsDraftPoints = null;
        stopAntsAnimationLoop();
        resizePaintCanvas(true);
        const c = $("paint-canvas");
        const ctx = c.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (snap.paint && snap.paint.width === c.width && snap.paint.height === c.height) {
            ctx.putImageData(snap.paint, 0, 0);
            pendingDoodleStackBoost = false;
        } else {
            ctx.clearRect(0, 0, c.width, c.height);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        syncAntsCanvasFromPaint();
        recomputePaintHasContent();
        redrawAntsOverlay();
        ensureAntsAnimationLoop();
        selectedId = normalizeSelectionAfterStateLoad(selectedId);
        renderStickers();
        renderLayers();
    }

    function normalizeSelectionAfterStateLoad(sel) {
        if (sel === DOODLES_LAYER_ID) return paintHasContent ? DOODLES_LAYER_ID : null;
        if (sel === BACKGROUND_LAYER_ID) return backgroundSrc ? BACKGROUND_LAYER_ID : null;
        if (items.some((x) => x.id === sel)) return sel;
        return null;
    }

    function beforeMutation() {
        past.push(cloneState());
        if (past.length > MAX_HISTORY) past.shift();
        future.length = 0;
        updateUndoRedo();
        scheduleAutosave();
    }

    function undo() {
        if (past.length === 0) return;
        future.push(cloneState());
        const prev = past.pop();
        applyState(prev);
        playBeep(false);
        updateUndoRedo();
        scheduleAutosave();
    }

    function redo() {
        if (future.length === 0) return;
        past.push(cloneState());
        const next = future.pop();
        applyState(next);
        playBeep(true);
        updateUndoRedo();
        scheduleAutosave();
    }

    function updateUndoRedo() {
        $("btn-undo").disabled = past.length === 0;
        $("btn-redo").disabled = future.length === 0;
    }

    function applyBackground() {
        const bg = $("canvas-bg");
        if (backgroundSrc) {
            bg.style.backgroundImage = 'url("' + backgroundSrc.replace(/"/g, '\\"') + '")';
        } else {
            bg.style.backgroundImage = "";
        }
    }

    function bumpDup(srcKey) {
        const n = (dupOffsets.get(srcKey) || 0) + 1;
        dupOffsets.set(srcKey, n);
        return n;
    }

    function addSticker(src, label) {
        beforeMutation();
        syncRects();
        const r = stageRect || stageBox();
        const dup = bumpDup(src);
        const offset = (dup - 1) * 0.06;
        const nx = Math.min(0.92, Math.max(0.08, 0.5 + offset * 0.5));
        const ny = Math.min(0.92, Math.max(0.08, 0.5 + offset * 0.45));
        const id = uid();
        const z = items.reduce((m, x) => Math.max(m, x.z), -1) + 1;
        items.push({
            id,
            src,
            label: label || "Sticker",
            nx,
            ny,
            scale: 1,
            rotation: 0,
            baseW: 0.22,
            z
        });
        clampPaintLayerRank();
        selectedId = id;
        renderStickers();
        renderLayers();
        scrollLayerIntoView(id);
        playBeep(true);
    }

    function setBackground(src) {
        beforeMutation();
        backgroundSrc = src;
        applyBackground();
        playBeep(false);
    }

    function removeItem(id) {
        beforeMutation();
        items = items.filter((x) => x.id !== id);
        clampPaintLayerRank();
        if (selectedId === id) selectedId = null;
        renderStickers();
        renderLayers();
    }

    function syncStickerSelectionHighlight() {
        const below = $("stickers-below-paint");
        const above = $("stickers-above-paint");
        [below, above].forEach((layer) => {
            if (!layer) return;
            layer.querySelectorAll(".sticker").forEach((el) => {
                el.classList.toggle("selected", el.dataset.id === selectedId);
            });
        });
    }

    function syncTextStickerEditButtons() {
        document.querySelectorAll(".sticker.sticker-text").forEach((wrap) => {
            const id = wrap.dataset.id;
            const show = id === selectedId;
            const existing = wrap.querySelector(".sticker-text-edit-btn");
            if (!show) {
                if (existing) existing.remove();
                return;
            }
            if (existing) return;
            const it = items.find((x) => x.id === id);
            if (!it || it.kind !== "text") return;
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "sticker-text-edit-btn";
            editBtn.setAttribute("aria-label", "Edit words");
            editBtn.innerHTML =
                '<svg class="sticker-text-edit-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
            editBtn.addEventListener("pointerdown", (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                openTextStickerModal(it.id);
            });
            wrap.appendChild(editBtn);
        });
    }

    function updateLayerRowSelectionHighlight() {
        const list = $("layers-list");
        if (!list) return;
        list.querySelectorAll(".layer-row").forEach((row) => {
            const kind = row.dataset.layerKind;
            if (!kind) return;
            const sid =
                kind === "doodles"
                    ? DOODLES_LAYER_ID
                    : kind === "background"
                      ? BACKGROUND_LAYER_ID
                      : row.dataset.id;
            row.classList.toggle("selected", sid === selectedId);
        });
    }

    function selectById(id, opts = {}) {
        selectedId = id;
        if (id === BACKGROUND_LAYER_ID || (id && items.some((x) => x.id === id))) {
            setPaintToolActive(false);
        }
        if (opts.skipStickerRender) {
            syncStickerSelectionHighlight();
            syncTextStickerEditButtons();
        } else {
            renderStickers();
        }
        if (opts.skipLayerRender) {
            updateLayerRowSelectionHighlight();
        } else {
            renderLayers();
        }
        if (!opts.skipScroll && id) {
            scrollLayerIntoView(id);
        }
    }

    function deselectAll() {
        selectedId = null;
        syncStickerSelectionHighlight();
        syncTextStickerEditButtons();
        renderLayers();
    }

    function scrollLayerIntoView(id) {
        if (!id) return;
        const row = layerRowEls.get(id);
        if (!row) return;
        row.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    function createItemWrap(it) {
        const wrap = document.createElement("div");
        wrap.className = "sticker" + (selectedId === it.id ? " selected" : "");
        wrap.dataset.id = it.id;

        if (it.kind === "text") {
            wrap.classList.add("sticker-text");
            const inner = document.createElement("div");
            inner.className = "sticker-text-inner";
            inner.textContent = it.text || "";
            const fontEntry = getTextFontEntry(it.textFont);
            inner.style.fontFamily = fontEntry.family;
            if (it.textRainbow) {
                inner.classList.add("is-text-rainbow");
                inner.style.color = "";
            } else {
                inner.classList.remove("is-text-rainbow");
                inner.style.color = it.textColor || "#2d3436";
            }
            if (it.textBorderless) inner.classList.add("is-text-borderless");
            wrap.appendChild(inner);
            applyStickerTransform(wrap, it);
            wrap.addEventListener("pointerdown", onStickerPointerDown);
            if (selectedId === it.id) {
                const editBtn = document.createElement("button");
                editBtn.type = "button";
                editBtn.className = "sticker-text-edit-btn";
                editBtn.setAttribute("aria-label", "Edit words");
                editBtn.innerHTML =
                    '<svg class="sticker-text-edit-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
                editBtn.addEventListener("pointerdown", (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    openTextStickerModal(it.id);
                });
                wrap.appendChild(editBtn);
            }
            return wrap;
        }

        const img = document.createElement("img");
        img.alt = it.label || "";
        img.draggable = false;
        img.src = it.src;

        img.onload = () => {
            const r = stageBox();
            const bw = Math.min(0.42, (img.naturalWidth / Math.max(r.width, 1)) * it.scale);
            it.baseW = Math.max(0.08, bw || it.baseW);
            applyStickerTransform(wrap, it);
        };

        applyStickerTransform(wrap, it);
        wrap.appendChild(img);
        wrap.addEventListener("pointerdown", onStickerPointerDown);
        return wrap;
    }

    function renderStickers() {
        const below = $("stickers-below-paint");
        const above = $("stickers-above-paint");
        if (!below || !above) return;
        below.innerHTML = "";
        above.innerHTML = "";
        clampPaintLayerRank();
        const asc = items.slice().sort((a, b) => a.z - b.z);
        const low = asc.slice(0, paintLayerRank);
        const high = asc.slice(paintLayerRank);
        let zi = 10;
        low.forEach((it) => {
            const w = createItemWrap(it);
            w.style.zIndex = String(zi++);
            below.appendChild(w);
        });
        zi = 10;
        high.forEach((it) => {
            const w = createItemWrap(it);
            w.style.zIndex = String(zi++);
            above.appendChild(w);
        });
    }

    function applyStickerTransform(el, it) {
        el.style.left = it.nx * 100 + "%";
        el.style.top = it.ny * 100 + "%";
        const bw = it.baseW || 0.22;
        const sc = Number(it.scale);
        const scale = Number.isFinite(sc) && sc > 0 ? sc : 1;
        el.style.width = bw * 100 * scale + "%";
        el.style.transform =
            "translate(-50%, -50%) rotate(" + it.rotation + "deg)";
        if (it.kind === "text") {
            el.style.setProperty("--text-sticker-scale", String(scale));
        } else {
            el.style.removeProperty("--text-sticker-scale");
        }
    }

    let dragState = null;

    const PAINT_TOOLS = [
        { pen: "round", size: 7, label: "Small dot" },
        { pen: "round", size: 13, label: "Medium dot" },
        { pen: "round", size: 22, label: "Big dot" },
        { pen: "round", size: 34, label: "Huge dot" },
        { pen: "spray", size: 22, label: "Spray paint" },
        { pen: "spray-wide", size: 32, label: "Big spray" },
        { pen: "pearls", size: 18, label: "Pearls" },
        { pen: "ants", size: 6, label: "Marching ants" }
    ];

    let textModalEditId = null;
    let textModalColor = SWATCHES[0];
    let textModalRainbow = false;
    let textModalFontId = "fredoka";
    let textModalBorderless = false;

    function getTextFontEntry(fid) {
        return TEXT_FONTS.find((x) => x.id === fid) || TEXT_FONTS[0];
    }

    function refreshPaintCursorUi() {
        const stage = $("canvas-stage");
        if (!stage) return;
        stage.classList.toggle("paint-tool-on", paintToolActive);
        stage.classList.toggle("paint-tool-brush", paintToolActive && !isEraser);
        stage.classList.toggle("paint-tool-eraser", paintToolActive && isEraser);
    }

    function syncPaintToolButtons() {
        const grid = $("paint-tool-grid");
        const er = $("btn-paint-eraser");
        if (grid) {
            grid.querySelectorAll(".btn-paint-tool").forEach((b) => {
                let active = false;
                if (paintToolActive && !isEraser) {
                    if (b.dataset.pen === penType && +b.dataset.size === paintSize) active = true;
                }
                b.classList.toggle("active", active);
            });
        }
        if (er) er.classList.toggle("active", !!(paintToolActive && isEraser));
    }

    function setPaintToolActive(on) {
        paintToolActive = on;
        const root = $("paint-section-root");
        if (root) root.classList.toggle("paint-active", !!on);
        refreshPaintCursorUi();
        syncPaintToolButtons();
    }

    function activatePaintTool(pen, size) {
        penType = pen;
        paintSize = size;
        isEraser = false;
        setPaintToolActive(true);
    }

    function activateEraserTool() {
        penType = "round";
        paintSize = 24;
        isEraser = true;
        paintRainbow = false;
        const sw = $("paint-swatches");
        if (sw) sw.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
        setPaintToolActive(true);
    }

    function buildModalSwatches() {
        const row = $("text-modal-swatches");
        if (!row) return;
        row.innerHTML = "";
        const rainbow = document.createElement("button");
        rainbow.type = "button";
        rainbow.className = "swatch swatch-rainbow";
        rainbow.setAttribute("aria-label", "Rainbow letters");
        rainbow.title = "Rainbow";
        rainbow.addEventListener("click", () => {
            row.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
            rainbow.classList.add("active");
            textModalRainbow = true;
        });
        row.appendChild(rainbow);

        SWATCHES.forEach((c) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "swatch";
            b.style.background = c;
            b.dataset.color = c;
            b.addEventListener("click", () => {
                row.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
                b.classList.add("active");
                textModalRainbow = false;
                textModalColor = c;
            });
            row.appendChild(b);
        });
        syncModalSwatchHighlight();
    }

    function syncModalSwatchHighlight() {
        const row = $("text-modal-swatches");
        if (!row) return;
        const norm = (textModalColor || "").toLowerCase();
        row.querySelectorAll(".swatch").forEach((b) => {
            const isRb = b.classList.contains("swatch-rainbow");
            let on = false;
            if (textModalRainbow) on = isRb;
            else if (!isRb && b.dataset.color)
                on = b.dataset.color.toLowerCase() === norm;
            b.classList.toggle("active", on);
        });
    }

    function syncModalFontButtons() {
        const row = $("text-modal-fonts");
        if (!row) return;
        row.querySelectorAll(".btn-text-font-pick").forEach((b) => {
            b.classList.toggle("active", b.dataset.fontId === textModalFontId);
        });
    }

    function openTextStickerModal(editId) {
        textModalEditId = editId == null ? null : editId;
        const m = $("text-sticker-modal");
        const title = $("text-sticker-title");
        const btn = $("text-sticker-confirm");
        const inp = $("text-sticker-input");
        if (!m || !inp) return;

        if (textModalEditId) {
            const it = items.find((x) => x.id === textModalEditId);
            if (title) title.textContent = "Change your words";
            if (btn) btn.textContent = "Save";
            inp.value = it && it.kind === "text" ? it.text || "" : "";
            textModalColor = (it && it.textColor) || SWATCHES[0];
            textModalRainbow = !!(it && it.textRainbow);
            textModalFontId = (it && it.textFont) || "fredoka";
            textModalBorderless = !!(it && it.textBorderless);
        } else {
            if (title) title.textContent = "Words on your picture";
            if (btn) btn.textContent = "Add to picture";
            inp.value = "";
            textModalColor = paintColor;
            textModalRainbow = paintRainbow;
            textModalFontId = "fredoka";
            textModalBorderless = false;
        }

        const borderlessInp = $("text-sticker-borderless");
        if (borderlessInp) borderlessInp.checked = textModalBorderless;

        buildModalSwatches();
        syncModalFontButtons();

        m.classList.remove("hidden");
        inp.focus();
        if (inp.value) inp.select();
    }

    function closeTextStickerModal() {
        const m = $("text-sticker-modal");
        if (m) m.classList.add("hidden");
        textModalEditId = null;
    }

    function confirmTextStickerModal() {
        const inp = $("text-sticker-input");
        const raw = inp && inp.value ? inp.value.trim() : "";
        if (!raw) {
            closeTextStickerModal();
            return;
        }
        const bEl = $("text-sticker-borderless");
        if (bEl) textModalBorderless = bEl.checked;
        const text = raw.slice(0, 140);
        if (textModalEditId) {
            const it = items.find((x) => x.id === textModalEditId);
            if (it && it.kind === "text") {
                beforeMutation();
                it.text = text;
                it.textFont = textModalFontId || "fredoka";
                it.textRainbow = textModalRainbow;
                it.textColor = textModalRainbow ? "#2d3436" : textModalColor;
                it.textBorderless = textModalBorderless;
                renderStickers();
                renderLayers();
                playBeep(true);
            }
            closeTextStickerModal();
            return;
        }
        addTextItem(text);
        closeTextStickerModal();
    }

    function addTextItem(text) {
        beforeMutation();
        syncRects();
        const dup = bumpDup("__text__");
        const offset = (dup - 1) * 0.06;
        const nx = Math.min(0.88, Math.max(0.12, 0.5 + offset * 0.45));
        const ny = Math.min(0.88, Math.max(0.12, 0.42 + offset * 0.35));
        const id = uid();
        const z = items.reduce((m, x) => Math.max(m, x.z), -1) + 1;
        items.push({
            id,
            kind: "text",
            text,
            textColor: textModalRainbow ? "#2d3436" : textModalColor,
            textRainbow: textModalRainbow,
            textFont: textModalFontId || "fredoka",
            textBorderless: textModalBorderless,
            label: "Text",
            nx,
            ny,
            scale: 1,
            rotation: 0,
            baseW: 0.44,
            z
        });
        clampPaintLayerRank();
        selectedId = id;
        setPaintToolActive(false);
        renderStickers();
        renderLayers();
        scrollLayerIntoView(id);
        playBeep(true);
    }

    function bindTextStickerModal() {
        const m = $("text-sticker-modal");
        if (!m) return;
        const fontsRoot = $("text-modal-fonts");
        if (fontsRoot && !fontsRoot.dataset.built) {
            fontsRoot.dataset.built = "1";
            TEXT_FONTS.forEach((f) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "btn btn-text-font-pick";
                b.dataset.fontId = f.id;
                b.title = f.label;
                b.setAttribute("aria-label", f.label);
                const span = document.createElement("span");
                span.className = "text-font-a-glyph";
                span.style.fontFamily = f.family;
                span.textContent = "A";
                b.appendChild(span);
                b.addEventListener("click", () => {
                    textModalFontId = f.id;
                    syncModalFontButtons();
                });
                fontsRoot.appendChild(b);
            });
        }

        const close = $("text-sticker-close");
        const ok = $("text-sticker-confirm");
        const borderlessInp = $("text-sticker-borderless");
        if (close) close.addEventListener("click", closeTextStickerModal);
        if (ok) ok.addEventListener("click", confirmTextStickerModal);
        if (borderlessInp && !borderlessInp.dataset.bound) {
            borderlessInp.dataset.bound = "1";
            borderlessInp.addEventListener("change", () => {
                textModalBorderless = borderlessInp.checked;
            });
        }
        m.addEventListener("click", (e) => {
            if (e.target === m) closeTextStickerModal();
        });
    }

    function strokeColorAt(lx, ly, opts) {
        if (paintRainbow) {
            if (opts && opts.sprayParticle) {
                const bandMs = 260;
                const hueStep = 39;
                const band = Math.floor(performance.now() / bandMs);
                const centerHue = (band * hueStep) % 360;
                const jitter = (Math.random() + Math.random() - 1) * 34;
                const hue = (((centerHue + jitter) % 360) + 360) % 360;
                const sat = 88 + Math.random() * 10;
                const lit = 58 + Math.random() * 14;
                return "hsl(" + hue + ", " + sat + "%, " + lit + "%)";
            }
            const hue = (lx * 2.8 + ly * 2.8 + performance.now() * 0.08) % 360;
            return "hsl(" + hue + ", 92%, 56%)";
        }
        return paintColor;
    }

    function applyExplosiveClearContent() {
        dupOffsets.clear();
        items = [];
        paintLayerRank = 0;
        selectedId = null;
        pendingDoodleStackBoost = true;
        backgroundSrc = null;
        applyBackground();
        clearPaintCanvasPixels();
        setPaintToolActive(false);
        painting = false;
        lastPaint = null;
        if ($("project-name")) $("project-name").value = "";
        renderStickers();
        renderLayers();
        syncRects();
        playBeep(false);
        scheduleAutosave();
    }

    function runExplosiveClear() {
        const btn = $("btn-explode-clear");
        const stage = $("canvas-stage");
        const stack = stage && stage.querySelector(".canvas-stack");
        const bgEl = $("canvas-bg");
        if (!stage || !stack || (btn && btn.disabled)) return;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            beforeMutation();
            playBeep(true);
            applyExplosiveClearContent();
            return;
        }

        if (btn) btn.disabled = true;
        beforeMutation();
        playBeep(true);

        const rect = stage.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const burst = document.createElement("div");
        burst.className = "canvas-explosion-burst";
        burst.setAttribute("aria-hidden", "true");
        const colors = ["#ff6b9d", "#ffd93d", "#43e97b", "#00c9ff", "#7c5cff", "#ffb84d", "#fff"];
        const n = 42;
        for (let i = 0; i < n; i++) {
            const p = document.createElement("div");
            p.className = "canvas-explosion-piece";
            const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.9;
            const dist = 70 + Math.random() * 140;
            const dx = Math.cos(ang) * dist;
            const dy = Math.sin(ang) * dist - 20 * Math.random();
            p.style.left = cx + "px";
            p.style.top = cy + "px";
            p.style.setProperty("--ex-dx", dx + "px");
            p.style.setProperty("--ex-dy", dy + "px");
            p.style.setProperty("--ex-rot", 360 + Math.random() * 720 + "deg");
            p.style.background =
                colors[(i + ((Math.random() * 3) | 0)) % colors.length];
            p.style.animationDelay = Math.random() * 0.06 + "s";
            if (Math.random() < 0.35) {
                p.style.borderRadius = "50%";
                p.style.width = "11px";
                p.style.height = "11px";
                p.style.margin = "-5px 0 0 -5px";
            }
            burst.appendChild(p);
        }
        document.body.appendChild(burst);

        stage.classList.add("canvas-stage--exploding");
        if (bgEl) bgEl.classList.add("canvas-bg--exploding");
        stack.classList.add("canvas-stack--exploding");

        const durationMs = 900;
        window.setTimeout(() => {
            applyExplosiveClearContent();
            stage.classList.remove("canvas-stage--exploding");
            if (bgEl) bgEl.classList.remove("canvas-bg--exploding");
            stack.classList.remove("canvas-stack--exploding");
            burst.remove();
            if (btn) btn.disabled = false;
        }, durationMs);
    }

    function deleteSelectedLayer() {
        if (!selectedId) return;
        if (selectedId === BACKGROUND_LAYER_ID) {
            beforeMutation();
            backgroundSrc = null;
            applyBackground();
            selectedId = null;
            renderStickers();
            renderLayers();
            playBeep(false);
            return;
        }
        if (selectedId === DOODLES_LAYER_ID) {
            beforeMutation();
            clearPaintCanvasPixels();
            selectedId = null;
            setPaintToolActive(true);
            renderLayers();
            playBeep(false);
            return;
        }
        removeItem(selectedId);
        playBeep(false);
    }

    function pointerDistance(a, b) {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function pointerAngle(a, b) {
        return Math.atan2(b.y - a.y, b.x - a.x);
    }

    function radiansToDegrees(radians) {
        return (radians * 180) / Math.PI;
    }

    function clearStickerTrashFeedback(state, el) {
        state.trashHot = false;
        $("trash-zone").classList.remove("hot");
        removeStickerTrashPreviewNode(state.trashPreviewEl);
        state.trashPreviewEl = null;
        if (el) el.style.opacity = "";
    }

    function onStickerPointerDown(e) {
        if (e.button === 2) return;
        const el = e.currentTarget;
        const id = el.dataset.id;

        if (dragState) {
            const firstPointer = dragState.pointers.values().next().value;
            const canJoinGesture =
                appSettings.twoFingerGestures &&
                e.pointerType === "touch" &&
                firstPointer &&
                firstPointer.pointerType === "touch" &&
                dragState.id === id &&
                !dragState.pointers.has(e.pointerId) &&
                dragState.pointers.size === 1;
            if (!canJoinGesture) return;

            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            dragState.pointers.set(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
                pointerType: e.pointerType
            });
            const points = [...dragState.pointers.values()];
            const it = items.find((x) => x.id === id);
            if (!it || points.length < 2) return;

            clearStickerTrashFeedback(dragState, el);
            dragState.gesture = {
                startDistance: Math.max(12, pointerDistance(points[0], points[1])),
                startAngle: pointerAngle(points[0], points[1]),
                origScale: it.scale,
                origRotation: it.rotation
            };
            el.classList.add("gesturing");
            return;
        }

        selectById(id, { skipStickerRender: true });
        const it = items.find((x) => x.id === id);
        if (!it) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add("dragging");
        syncRects();
        dragState = {
            id,
            el,
            primaryPid: e.pointerId,
            pointers: new Map([
                [
                    e.pointerId,
                    { x: e.clientX, y: e.clientY, pointerType: e.pointerType }
                ]
            ]),
            gesture: null,
            startX: e.clientX,
            startY: e.clientY,
            origNx: it.nx,
            origNy: it.ny,
            trashHot: false,
            trashPreviewEl: null,
            moved: false,
            undoCommitted: false
        };
        el.addEventListener("pointermove", onStickerPointerMove, POINTER_MOVE_OPTS);
        el.addEventListener("pointerup", onStickerPointerUp);
        el.addEventListener("pointercancel", onStickerPointerUp);
    }

    function onStickerPointerMove(e) {
        if (!dragState || !dragState.pointers.has(e.pointerId)) return;
        e.preventDefault();
        dragState.pointers.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
            pointerType: e.pointerType
        });
        const it = items.find((x) => x.id === dragState.id);
        if (!it) return;

        if (dragState.gesture && dragState.pointers.size >= 2) {
            const points = [...dragState.pointers.values()];
            const distance = Math.max(12, pointerDistance(points[0], points[1]));
            const angle = pointerAngle(points[0], points[1]);
            const scale = Math.min(
                3.2,
                Math.max(
                    0.35,
                    dragState.gesture.origScale *
                        (distance / dragState.gesture.startDistance)
                )
            );
            const angleDelta = Math.atan2(
                Math.sin(angle - dragState.gesture.startAngle),
                Math.cos(angle - dragState.gesture.startAngle)
            );
            const rotation =
                dragState.gesture.origRotation + radiansToDegrees(angleDelta);
            const scaleChange = Math.abs(
                Math.log(Math.max(0.001, scale / dragState.gesture.origScale))
            );
            const rotationChange = Math.abs(rotation - dragState.gesture.origRotation);

            if (
                !dragState.undoCommitted &&
                (scaleChange > 0.015 || rotationChange > 1)
            ) {
                beforeMutation();
                dragState.undoCommitted = true;
            }
            if (dragState.undoCommitted) {
                it.scale = scale;
                it.rotation = rotation;
                dragState.moved = true;
                applyStickerTransform(dragState.el, it);
            }
            return;
        }

        if (e.pointerId !== dragState.primaryPid) return;
        dragState.moved = true;
        const dragPx = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
        if (!dragState.undoCommitted && dragPx > 6) {
            beforeMutation();
            dragState.undoCommitted = true;
        }
        syncRects();
        const r = stageRect;
        const dx = (e.clientX - dragState.startX) / r.width;
        const dy = (e.clientY - dragState.startY) / r.height;
        it.nx = Math.min(1, Math.max(0, dragState.origNx + dx));
        it.ny = Math.min(1, Math.max(0, dragState.origNy + dy));

        const el = document.querySelector('.sticker[data-id="' + dragState.id + '"]');
        if (el) applyStickerTransform(el, it);

        const hot =
            e.clientX >= trashRect.left &&
            e.clientX <= trashRect.right &&
            e.clientY >= trashRect.top &&
            e.clientY <= trashRect.bottom;
        if (hot !== dragState.trashHot) {
            dragState.trashHot = hot;
            $("trash-zone").classList.toggle("hot", hot);
        }

        if (el) {
            if (hot) {
                if (!dragState.trashPreviewEl) {
                    const prev = document.createElement("div");
                    prev.className = "sticker-drag-trash-preview";
                    prev.setAttribute("aria-hidden", "true");
                    fillStickerTrashPreviewContent(el, prev);
                    document.body.appendChild(prev);
                    dragState.trashPreviewEl = prev;
                }
                layoutStickerTrashPreview(dragState.trashPreviewEl);
                el.style.opacity = "0.2";
            } else {
                if (dragState.trashPreviewEl) {
                    removeStickerTrashPreviewNode(dragState.trashPreviewEl);
                    dragState.trashPreviewEl = null;
                }
                el.style.opacity = "";
            }
        }
    }

    function fillStickerTrashPreviewContent(sourceEl, target) {
        target.innerHTML = "";
        const img = sourceEl.querySelector("img");
        if (img) {
            const c = img.cloneNode(true);
            c.draggable = false;
            target.appendChild(c);
            return;
        }
        const inner = sourceEl.querySelector(".sticker-text-inner");
        if (inner) target.appendChild(inner.cloneNode(true));
    }

    function layoutStickerTrashPreview(previewEl) {
        const tz = $("trash-zone");
        if (!previewEl || !tz) return;
        const r = tz.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const size = Math.min(76, Math.max(48, Math.min(r.width, r.height) * 1.05));
        previewEl.style.left = cx + "px";
        previewEl.style.top = cy + "px";
        previewEl.style.width = size + "px";
        previewEl.style.height = size + "px";
    }

    function removeStickerTrashPreviewNode(node) {
        if (node && node.parentNode) node.remove();
    }

    function onStickerPointerUp(e) {
        if (!dragState || !dragState.pointers.has(e.pointerId)) return;
        const state = dragState;
        const el = state.el || document.querySelector('.sticker[data-id="' + state.id + '"]');
        if (el && el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
        }
        state.pointers.delete(e.pointerId);

        if (state.gesture && state.pointers.size === 1) {
            const [remainingPid, point] = state.pointers.entries().next().value;
            const it = items.find((x) => x.id === state.id);
            state.gesture = null;
            state.primaryPid = remainingPid;
            state.startX = point.x;
            state.startY = point.y;
            state.origNx = it ? it.nx : state.origNx;
            state.origNy = it ? it.ny : state.origNy;
            state.moved = false;
            clearStickerTrashFeedback(state, el);
            if (el) el.classList.remove("gesturing");
            return;
        }

        if (state.pointers.size > 0) return;

        const trashPreview = state.trashPreviewEl;
        let trashPreviewRect = null;
        if (trashPreview) {
            trashPreviewRect = trashPreview.getBoundingClientRect();
        }
        if (el) {
            el.classList.remove("dragging", "gesturing");
            el.removeEventListener("pointermove", onStickerPointerMove, POINTER_MOVE_OPTS);
            el.removeEventListener("pointerup", onStickerPointerUp);
            el.removeEventListener("pointercancel", onStickerPointerUp);
        }
        $("trash-zone").classList.remove("hot");

        const dropToTrash = e.type !== "pointercancel" && !state.gesture && state.trashHot;
        const droppedId = state.id;
        dragState = null;
        scheduleAutosave();

        removeStickerTrashPreviewNode(trashPreview);
        if (el) el.style.opacity = "";

        if (dropToTrash && el) {
            const startRect =
                trashPreviewRect &&
                trashPreviewRect.width > 2 &&
                trashPreviewRect.height > 2
                    ? trashPreviewRect
                    : null;
            animateStickerToTrashThenRemove(el, droppedId, startRect);
            return;
        }

        if (dropToTrash) {
            syncRects();
            poofAt(trashRect.left + trashRect.width / 2, trashRect.top + trashRect.height / 2);
            removeItem(droppedId);
            playBeep(false);
        }
    }

    function animateStickerToTrashThenRemove(el, id, startRectOpt) {
        syncRects();
        const elRect = el.getBoundingClientRect();
        const rect =
            startRectOpt && startRectOpt.width > 2 && startRectOpt.height > 2
                ? startRectOpt
                : elRect;
        const tx = trashRect.left + trashRect.width / 2;
        const ty = trashRect.top + trashRect.height / 2;
        const imgSrc = el.querySelector("img");
        const ghost = document.createElement("div");
        ghost.className = "sticker-trash-ghost";
        ghost.setAttribute("aria-hidden", "true");
        if (imgSrc) {
            const im = imgSrc.cloneNode(true);
            im.draggable = false;
            ghost.appendChild(im);
        } else {
            const inner = el.querySelector(".sticker-text-inner");
            if (inner) {
                const clone = inner.cloneNode(true);
                clone.style.pointerEvents = "none";
                ghost.appendChild(clone);
            }
        }
        ghost.style.left = rect.left + "px";
        ghost.style.top = rect.top + "px";
        ghost.style.width = Math.max(1, rect.width) + "px";
        ghost.style.height = Math.max(1, rect.height) + "px";
        ghost.style.opacity = "1";
        ghost.style.transition = "none";
        document.body.appendChild(ghost);

        el.style.visibility = "hidden";

        const tw = Math.max(24, rect.width * 0.2);
        const th = Math.max(24, rect.height * 0.2);
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            ghost.remove();
            poofAt(tx, ty);
            removeItem(id);
            playBeep(false);
        };
        window.setTimeout(done, 400);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ghost.style.transition =
                    "left 0.38s cubic-bezier(0.22, 1, 0.36, 1), top 0.38s cubic-bezier(0.22, 1, 0.36, 1), width 0.38s cubic-bezier(0.22, 1, 0.36, 1), height 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.36s ease";
                ghost.style.left = tx - tw / 2 + "px";
                ghost.style.top = ty - th / 2 + "px";
                ghost.style.width = tw + "px";
                ghost.style.height = th + "px";
                ghost.style.opacity = "0.38";
            });
        });
    }

    function poofAt(x, y) {
        const layer = document.createElement("div");
        layer.className = "poof-layer";
        const parts = ["✨", "⭐", "💫", "🌟", "✨"];
        for (let i = 0; i < 14; i++) {
            const p = document.createElement("span");
            p.className = "poof-particle";
            p.textContent = parts[i % parts.length];
            const ang = (Math.PI * 2 * i) / 14;
            const dist = 40 + Math.random() * 50;
            p.style.left = x + "px";
            p.style.top = y + "px";
            p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
            p.style.setProperty("--dy", Math.sin(ang) * dist - 20 + "px");
            layer.appendChild(p);
        }
        document.body.appendChild(layer);
        setTimeout(() => layer.remove(), 900);
    }

    function renderLayers() {
        const list = $("layers-list");
        list.innerHTML = "";
        layerRowEls = new Map();
        clampPaintLayerRank();
        let panelIdx = 0;
        const order = buildPanelOrder();
        for (const entry of order) {
            if (entry.type === "doodles") {
                if (!paintHasContent) continue;
                const row = document.createElement("div");
                row.className =
                    "layer-row layer-doodles-row" +
                    (selectedId === DOODLES_LAYER_ID ? " selected" : "");
                row.dataset.id = DOODLES_LAYER_ID;
                row.dataset.layerKind = "doodles";
                row.dataset.panelIndex = String(panelIdx++);

                const thumb = document.createElement("div");
                thumb.className = "layer-thumb";
                thumb.textContent = "🖍️";
                thumb.setAttribute("aria-hidden", "true");

                const info = document.createElement("div");
                info.className = "layer-info";
                info.textContent = "Doodles";

                const handle = document.createElement("div");
                handle.className = "layer-handle";
                handle.textContent = "⋮⋮";

                row.appendChild(thumb);
                row.appendChild(info);
                row.appendChild(handle);
                row.addEventListener("pointerdown", onLayerRowPointerDown);
                list.appendChild(row);
                layerRowEls.set(DOODLES_LAYER_ID, row);
                continue;
            }

            const it = items.find((x) => x.id === entry.id);
            if (!it) continue;
            const row = document.createElement("div");
            row.className = "layer-row" + (selectedId === it.id ? " selected" : "");
            row.dataset.id = it.id;
            row.dataset.layerKind = it.kind === "text" ? "text" : "sticker";
            row.dataset.panelIndex = String(panelIdx++);

            const thumb = document.createElement("div");
            thumb.className = "layer-thumb";
            if (it.kind === "text") {
                thumb.classList.add("layer-thumb-text");
                thumb.textContent = (it.text || "Text").slice(0, 42);
            } else {
                const im = document.createElement("img");
                im.src = it.src;
                im.alt = "";
                thumb.appendChild(im);
            }

            const info = document.createElement("div");
            info.className = "layer-info";
            info.textContent = it.kind === "text" ? "Text" : it.label || "Sticker";

            const handle = document.createElement("div");
            handle.className = "layer-handle";
            handle.textContent = "⋮⋮";

            row.appendChild(thumb);
            row.appendChild(info);
            row.appendChild(handle);

            row.addEventListener("pointerdown", onLayerRowPointerDown);

            list.appendChild(row);
            layerRowEls.set(it.id, row);
        }

        if (backgroundSrc) {
            const row = document.createElement("div");
            row.className =
                "layer-row layer-bg-row layer-locked" +
                (selectedId === BACKGROUND_LAYER_ID ? " selected" : "");
            row.dataset.id = BACKGROUND_LAYER_ID;
            row.dataset.layerKind = "background";
            const thumb = document.createElement("div");
            thumb.className = "layer-thumb bg-thumb";
            thumb.style.backgroundImage = 'url("' + backgroundSrc.replace(/"/g, '\\"') + '")';
            const info = document.createElement("div");
            info.className = "layer-info";
            info.textContent = "Background";
            const handle = document.createElement("div");
            handle.className = "layer-handle";
            handle.innerHTML = '<span class="layer-lock-icon" title="Locked">🔒</span>';
            handle.setAttribute("aria-hidden", "true");
            row.appendChild(thumb);
            row.appendChild(info);
            row.appendChild(handle);
            row.addEventListener("pointerdown", onLayerRowPointerDown);
            list.appendChild(row);
            layerRowEls.set(BACKGROUND_LAYER_ID, row);
        }
    }

    function onLayerRowPointerDown(e) {
        const row = e.currentTarget;
        if (row.dataset.layerKind === "background") {
            selectById(BACKGROUND_LAYER_ID, {
                skipStickerRender: true,
                skipLayerRender: true,
                skipScroll: true
            });
            updateLayerRowSelectionHighlight();
            e.preventDefault();
            return;
        }
        const id = row.dataset.id;
        const kind = row.dataset.layerKind || "sticker";
        if (kind === "doodles") {
            selectedId = DOODLES_LAYER_ID;
            syncStickerSelectionHighlight();
            updateLayerRowSelectionHighlight();
        } else {
            selectById(id, {
                skipStickerRender: true,
                skipLayerRender: true,
                skipScroll: true
            });
        }
        const listEl = $("layers-list");
        const dropLine = document.createElement("div");
        dropLine.className = "layer-drop-indicator";
        dropLine.setAttribute("aria-hidden", "true");
        listEl.appendChild(dropLine);

        layerDrag = {
            id,
            kind,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            lastClientY: e.clientY,
            startPanelIndex: +row.dataset.panelIndex,
            insertBefore: +row.dataset.panelIndex,
            row,
            listEl,
            dropLineEl: dropLine
        };
        row.classList.add("dragging-row");
        layerDrag.listEl.classList.add("layer-drag-active");
        updateLayerDropUi(e.clientY);
        row.setPointerCapture(e.pointerId);
        row.addEventListener("pointermove", onLayerRowMove, POINTER_MOVE_OPTS);
        row.addEventListener("pointerup", onLayerRowUp);
        row.addEventListener("pointercancel", onLayerRowUp);
        e.preventDefault();
    }

    function onLayerRowMove(e) {
        if (!layerDrag || e.pointerId !== layerDrag.pointerId) return;
        e.preventDefault();
        layerDrag.lastClientY = e.clientY;
        updateLayerDropUi(e.clientY);
        autoScrollLayersForDrag(e.clientY);
        scheduleLayerEdgeScrollIfNeeded(e.clientY);
    }

    function onLayerRowUp(e) {
        if (!layerDrag || e.pointerId !== layerDrag.pointerId) return;
        cancelLayerEdgeScroll();
        const row = layerDrag.row;
        const dropLineEl = layerDrag.dropLineEl;
        const listEl = layerDrag.listEl;
        row.releasePointerCapture(e.pointerId);
        row.classList.remove("dragging-row");
        listEl.classList.remove("layer-drag-active");
        row.removeEventListener("pointermove", onLayerRowMove, POINTER_MOVE_OPTS);
        row.removeEventListener("pointerup", onLayerRowUp);
        row.removeEventListener("pointercancel", onLayerRowUp);

        if (dropLineEl && dropLineEl.parentNode) {
            dropLineEl.remove();
        }

        const tap =
            Math.hypot(e.clientX - layerDrag.startX, e.clientY - layerDrag.startY) < 12;
        const pickedId = layerDrag.id;

        const L0 = buildPanelOrder();
        const L = L0.slice();
        const from = layerDrag.startPanelIndex;
        let insertBefore =
            layerDrag.insertBefore != null ? layerDrag.insertBefore : from;
        const [entry] = L.splice(from, 1);
        let ins = insertBefore;
        if (from < ins) ins--;
        L.splice(ins, 0, entry);
        const changed = JSON.stringify(L0) !== JSON.stringify(L);

        if (changed) {
            const prevRects = captureLayerRowRects();
            beforeMutation();
            applyPanelOrder(L);
            renderStickers();
            renderLayers();
            animateLayerRowsFlip(prevRects);
            scrollLayerIntoView(pickedId);
            playBeep(true);
        } else {
            updateLayerRowSelectionHighlight();
            if (tap) {
                scrollLayerIntoView(pickedId);
            }
        }
        layerDrag = null;
    }

    function transformSelected(fn) {
        if (!selectedId || selectedId === DOODLES_LAYER_ID || selectedId === BACKGROUND_LAYER_ID)
            return;
        const it = items.find((x) => x.id === selectedId);
        if (!it) return;
        const sc0 = Number(it.scale);
        if (!Number.isFinite(sc0) || sc0 <= 0) it.scale = 1;
        beforeMutation();
        fn(it);
        renderStickers();
        renderLayers();
        playBeep(true);
    }

    function buildItemsPanel() {
        const root = $("items-root");
        root.innerHTML = "";
        const tplSection = document.getElementById("tpl-section");
        const tplPaint = document.getElementById("tpl-paint-tools");
        const tplText = document.getElementById("tpl-text-section");

        for (const sec of manifest.sections) {
            if (sec.kind === "paint") {
                const frag = tplPaint.content.cloneNode(true);
                root.appendChild(frag);
                setupPaintSection(root.lastElementChild);
                continue;
            }
            if (sec.kind === "text" && tplText) {
                const frag = tplText.content.cloneNode(true);
                root.appendChild(frag);
                setupTextSection(root.lastElementChild);
                continue;
            }
            const node = tplSection.content.cloneNode(true);
            const h = node.querySelector(".item-section-title");
            const grid = node.querySelector(".item-grid");
            h.textContent = sec.label;
            const list = sec.items || [];
            if (list.length === 0) {
                const empty = document.createElement("p");
                empty.className = "hint";
                empty.style.margin = "0";
                empty.textContent = sec.folder
                    ? "Add " +
                      (manifest.numberPadding || 3) +
                      "-digit PNGs (001.png, 002.png…) in " +
                      sec.folder +
                      " — stops after " +
                      (manifest.stopAfterMisses != null
                          ? manifest.stopAfterMisses
                          : 10) +
                      " misses. Optional: filenameTemplate / alternateFilenameTemplates in manifest."
                    : sec.kind === "background"
                      ? "Add background PNGs (see assets folder)."
                      : "Add PNGs (see assets folder).";
                grid.appendChild(empty);
            }
            for (const it of list) {
                const src = resolveItemSrc(it);
                const tile = document.createElement("button");
                tile.type = "button";
                tile.className = "item-tile";
                tile.title = it.label || "";
                const img = document.createElement("img");
                img.src = src;
                img.alt = it.label || "";
                tile.appendChild(img);
                tile.addEventListener("click", () => {
                    setPaintToolActive(false);
                    if (sec.kind === "background") {
                        setBackground(src);
                        selectById(BACKGROUND_LAYER_ID, { skipScroll: true });
                    } else {
                        addSticker(src, it.label || it.id);
                    }
                });
                grid.appendChild(tile);
            }
            root.appendChild(node);
        }
    }

    function setupTextSection(container) {
        const btn = container.querySelector("#btn-text-section-open");
        if (btn) {
            btn.addEventListener("click", () => {
                setPaintToolActive(false);
                openTextStickerModal();
            });
        }
    }

    function setupPaintSection(container) {
        const grid = container.querySelector("#paint-tool-grid");
        const sw = container.querySelector("#paint-swatches");
        if (!grid || !sw) return;
        grid.innerHTML = "";
        sw.innerHTML = "";

        PAINT_TOOLS.forEach((t) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "btn btn-paint-tool";
            b.dataset.pen = t.pen;
            b.dataset.size = String(t.size);
            b.setAttribute("aria-label", t.label);
            b.title = t.label;
            if (t.pen === "pearls") {
                const wrap = document.createElement("span");
                wrap.className = "paint-tool-pearls-glyph";
                wrap.innerHTML = "<span></span><span></span>";
                b.appendChild(wrap);
            } else if (t.pen === "ants") {
                const ag = document.createElement("span");
                ag.className = "paint-tool-ants-glyph";
                ag.setAttribute("aria-hidden", "true");
                ag.innerHTML =
                    '<svg class="paint-tool-ants-svg" width="24" height="16" viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
                    '<ellipse cx="17.5" cy="8" rx="5" ry="3.4" fill="currentColor" opacity="0.92"/>' +
                    '<ellipse cx="11" cy="8" rx="3.2" ry="2.8" fill="currentColor" opacity="0.82"/>' +
                    '<circle cx="6.2" cy="8" r="2.4" fill="currentColor" opacity="0.72"/>' +
                    '<path d="M6 5.2 Q4 3 2 2.2M6 10.8 Q4 13 2 13.8M11 5.5 Q10 2 8.5 0.8M11 10.5 Q10 14 8.5 15.2M15.5 5.8 Q16 3 17.5 1.5M15.5 10.2 Q16 13 17.5 14.5" fill="none" stroke="currentColor" stroke-width="0.85" stroke-linecap="round"/>' +
                    '<path d="M3.8 6.5 Q1.5 5.5 0.3 3.8M3.8 9.5 Q1.5 10.5 0.3 12.2" fill="none" stroke="currentColor" stroke-width="0.65" stroke-linecap="round"/>' +
                    '<circle cx="5.05" cy="7.05" r="0.5" fill="#fff" opacity="0.95"/><circle cx="5.05" cy="8.95" r="0.5" fill="#fff" opacity="0.95"/>' +
                    "</svg>";
                b.appendChild(ag);
            } else if (t.pen === "spray" || t.pen === "spray-wide") {
                const span = document.createElement("span");
                span.className =
                    t.pen === "spray-wide" ? "paint-tool-spray-wide" : "paint-tool-spray";
                span.textContent = "\u2726";
                span.setAttribute("aria-hidden", "true");
                b.appendChild(span);
            } else {
                const d = Math.round(Math.min(30, t.size * 0.55 + 6));
                const glyph = document.createElement("span");
                glyph.className = "paint-tool-glyph";
                glyph.style.width = d + "px";
                glyph.style.height = d + "px";
                glyph.setAttribute("aria-hidden", "true");
                b.appendChild(glyph);
            }
            b.addEventListener("click", () => activatePaintTool(t.pen, t.size));
            grid.appendChild(b);
        });

        const erBtn = $("btn-paint-eraser");
        if (erBtn) erBtn.addEventListener("click", () => activateEraserTool());

        const rainbow = document.createElement("button");
        rainbow.type = "button";
        rainbow.className = "swatch swatch-rainbow";
        rainbow.setAttribute("aria-label", "Rainbow colors");
        rainbow.title = "Rainbow";
        rainbow.addEventListener("click", () => {
            sw.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
            rainbow.classList.add("active");
            paintRainbow = true;
            isEraser = false;
            setPaintToolActive(true);
        });
        sw.appendChild(rainbow);

        SWATCHES.forEach((c, i) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "swatch" + (i === 0 ? " active" : "");
            b.style.background = c;
            b.dataset.color = c;
            b.addEventListener("click", () => {
                sw.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
                b.classList.add("active");
                paintColor = c;
                paintRainbow = false;
                isEraser = false;
                setPaintToolActive(true);
            });
            sw.appendChild(b);
        });

        penType = "round";
        paintSize = 22;
        isEraser = false;
        paintRainbow = false;
        syncPaintToolButtons();
    }

    function resizePaintCanvas(skipHistory) {
        const c = $("paint-canvas");
        const st = $("canvas-stage");
        const ctx = c.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = st.clientWidth;
        const h = st.clientHeight;
        const tw = Math.max(1, Math.floor(w * dpr));
        const th = Math.max(1, Math.floor(h * dpr));

        if (c.width !== tw || c.height !== th) {
            let backup = null;
            if (c.width && c.height) {
                try {
                    backup = ctx.getImageData(0, 0, c.width, c.height);
                } catch (_) {}
            }
            c.width = tw;
            c.height = th;
            c.style.width = w + "px";
            c.style.height = h + "px";
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            if (backup && w && h) {
                const oc = document.createElement("canvas");
                oc.width = backup.width;
                oc.height = backup.height;
                oc.getContext("2d").putImageData(backup, 0, 0);
                ctx.drawImage(oc, 0, 0, w, h);
            } else if (!skipHistory) {
                ctx.clearRect(0, 0, w, h);
            }
        }

        syncAntsCanvasFromPaint();
        redrawAntsOverlay();
        ensureAntsAnimationLoop();
    }

    function paintPoint(x, y) {
        const c = $("paint-canvas");
        const ctx = c.getContext("2d");
        const st = $("canvas-stage");
        const rect = st.getBoundingClientRect();
        const lx = x - rect.left;
        const ly = y - rect.top;
        if (isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#000";
        } else {
            ctx.globalCompositeOperation = "source-over";
            const col = strokeColorAt(lx, ly);
            ctx.fillStyle = col;
            ctx.strokeStyle = col;
            const alpha =
                penType === "spray" || penType === "spray-wide"
                    ? paintRainbow
                        ? 0.52
                        : 0.35
                    : paintRainbow
                      ? 0.92
                      : 0.88;
            ctx.globalAlpha = alpha;
        }

        const r = paintSize / 2;
        if (isEraser) {
            ctx.beginPath();
            ctx.arc(lx, ly, r * 1.15, 0, Math.PI * 2);
            ctx.fill();
        } else if (penType === "spray") {
            const n = paintRainbow ? 12 : 20;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.random() * r * 1.85;
                const dot = paintRainbow ? 1.4 : 1.2;
                ctx.fillStyle = paintRainbow
                    ? strokeColorAt(0, 0, { sprayParticle: true })
                    : strokeColorAt(lx + Math.cos(a) * d, ly + Math.sin(a) * d);
                ctx.beginPath();
                ctx.arc(lx + Math.cos(a) * d, ly + Math.sin(a) * d, dot, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (penType === "spray-wide") {
            const n = paintRainbow ? 22 : 38;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.random() * r * 2.35;
                const px = lx + Math.cos(a) * d;
                const py = ly + Math.sin(a) * d;
                ctx.fillStyle = paintRainbow
                    ? strokeColorAt(0, 0, { sprayParticle: true })
                    : strokeColorAt(px, py);
                ctx.beginPath();
                ctx.arc(px, py, 1.2 + Math.random() * 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (penType === "pearls") {
            const pearlR = Math.max(4, paintSize * 0.38);
            const minDist = pearlR * 1.55;
            const col = strokeColorAt(lx, ly);
            ctx.globalAlpha = 1;
            if (!lastPearl || Math.hypot(lx - lastPearl.lx, ly - lastPearl.ly) >= minDist) {
                paintPearlDot(ctx, lx, ly, col, pearlR, !!lastPearl);
                lastPearl = { lx, ly };
            }
        } else {
            ctx.beginPath();
            ctx.arc(lx, ly, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
    }

    function bindPaintCanvas() {
        const c = $("paint-canvas");
        const onDown = (e) => {
            if (!paintToolActive) return;
            painting = true;
            lastPaint = { x: e.clientX, y: e.clientY };
            lastPearl = null;

            if (penType === "ants") {
                beforeMutation();
                const st = $("canvas-stage");
                const rect = st.getBoundingClientRect();
                const W = Math.max(1, st.clientWidth);
                const H = Math.max(1, st.clientHeight);
                const lx = e.clientX - rect.left;
                const ly = e.clientY - rect.top;
                antsDraftPoints = [{ nx: lx / W, ny: ly / H }];
                ensureAntsAnimationLoop();
                e.preventDefault();
                return;
            }

            beforeMutation();
            paintPoint(e.clientX, e.clientY);
            e.preventDefault();
        };
        const onMove = (e) => {
            if (!painting || !paintToolActive) return;
            const x = e.clientX;
            const y = e.clientY;
            if (penType === "ants") {
                if (lastPaint) {
                    appendAntsDraftSegment(lastPaint.x, lastPaint.y, x, y);
                }
                lastPaint = { x, y };
                e.preventDefault();
                return;
            }
            if (lastPaint) {
                const dx = x - lastPaint.x;
                const dy = y - lastPaint.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const rainbowSpray =
                    paintRainbow &&
                    (penType === "spray" || penType === "spray-wide");
                const stepPx = rainbowSpray ? paintSize * 0.82 : paintSize * 0.35;
                const steps = Math.max(1, Math.ceil(dist / stepPx));
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    paintPoint(lastPaint.x + dx * t, lastPaint.y + dy * t);
                }
            }
            lastPaint = { x, y };
            e.preventDefault();
        };
        const onUp = () => {
            if (painting) {
                if (penType === "ants" && antsDraftPoints && antsDraftPoints.length >= 2) {
                    antsPaths.push({
                        points: antsDraftPoints.slice(),
                        rainbow: paintRainbow,
                        color: paintColor,
                        lineWidth: Math.max(2, paintSize * 0.48)
                    });
                }
                antsDraftPoints = null;
                painting = false;
                lastPaint = null;
                const hadPaintBefore = paintHasContent;
                recomputePaintHasContent();
                ensureAntsAnimationLoop();
                if (
                    paintHasContent &&
                    !hadPaintBefore &&
                    pendingDoodleStackBoost &&
                    items.length > 0
                ) {
                    paintLayerRank = items.length;
                    clampPaintLayerRank();
                    pendingDoodleStackBoost = false;
                }
                renderStickers();
                renderLayers();
                scheduleAutosave();
            }
        };
        c.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    }

    function serializeForUrl(includePaint) {
        const c = $("paint-canvas");
        let paintB64 = null;
        if (includePaint && c.width && c.height) {
            try {
                paintB64 = c.toDataURL("image/png");
            } catch (_) {}
        }
        return {
            v: 1,
            theme: document.documentElement.getAttribute("data-theme") || "candy",
            bg: backgroundSrc,
            paintLayerRank,
            items: items.map((it) => {
                const base = {
                    nx: +it.nx.toFixed(4),
                    ny: +it.ny.toFixed(4),
                    scale: +it.scale.toFixed(3),
                    rotation: Math.round(it.rotation),
                    baseW: +it.baseW.toFixed(4),
                    z: it.z
                };
                if (it.kind === "text") {
                    return Object.assign(base, {
                        kind: "text",
                        text: it.text || "",
                        textColor: it.textColor || "#2d3436",
                        textRainbow: !!it.textRainbow,
                        textFont: it.textFont || "fredoka",
                        textBorderless: !!it.textBorderless,
                        label: it.label || "Text"
                    });
                }
                return Object.assign(base, {
                    src: it.src,
                    label: it.label
                });
            }),
            paint: paintB64,
            ants: includePaint ? serializeAntsForUrl() : undefined
        };
    }

    function applyFromSerialized(obj) {
        if (!obj || obj.v !== 1) return false;
        if ($("project-name")) $("project-name").value = "";
        applySceneTheme(obj.theme || DEFAULT_APP_SETTINGS.theme);
        backgroundSrc = obj.bg || null;
        applyBackground();
        antsPaths = antsFromSerialized(obj.ants);
        antsDraftPoints = null;
        stopAntsAnimationLoop();
        items = (obj.items || []).map((it, i) => {
            const id = uid();
            if (it.kind === "text" || (it.text != null && !it.src)) {
                return {
                    id,
                    kind: "text",
                    text: String(it.text || "").slice(0, 140),
                    textColor: it.textColor || "#2d3436",
                    textRainbow: !!it.textRainbow,
                    textFont: it.textFont || "fredoka",
                    textBorderless: !!it.textBorderless,
                    label: it.label || "Text",
                    nx: it.nx,
                    ny: it.ny,
                    scale: it.scale ?? 1,
                    rotation: it.rotation || 0,
                    baseW: it.baseW || 0.44,
                    z: it.z ?? i
                };
            }
            return {
                id,
                src: it.src,
                label: it.label || "Sticker",
                nx: it.nx,
                ny: it.ny,
                scale: it.scale ?? 1,
                rotation: it.rotation || 0,
                baseW: it.baseW || 0.22,
                z: it.z ?? i
            };
        });
        paintLayerRank = obj.paintLayerRank != null ? obj.paintLayerRank : 0;
        clampPaintLayerRank();
        selectedId = null;
        pendingDoodleStackBoost = false;
        resizePaintCanvas(true);
        const c = $("paint-canvas");
        const ctx = c.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        if (obj.paint) {
            const im = new Image();
            im.onload = () => {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(im, 0, 0, c.width, c.height);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                syncAntsCanvasFromPaint();
                recomputePaintHasContent();
                redrawAntsOverlay();
                ensureAntsAnimationLoop();
                renderStickers();
                renderLayers();
                scheduleAutosave();
            };
            im.onerror = () => {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                syncAntsCanvasFromPaint();
                recomputePaintHasContent();
                redrawAntsOverlay();
                ensureAntsAnimationLoop();
                renderStickers();
                renderLayers();
                scheduleAutosave();
            };
            im.src = obj.paint;
        } else {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            syncAntsCanvasFromPaint();
            recomputePaintHasContent();
            redrawAntsOverlay();
            ensureAntsAnimationLoop();
            scheduleAutosave();
        }
        renderStickers();
        renderLayers();
        past.length = 0;
        future.length = 0;
        updateUndoRedo();
        setPaintToolActive(false);
        return true;
    }

    function encodeHash(obj) {
        const s = JSON.stringify(obj);
        return "#m=" + btoa(unescape(encodeURIComponent(s)));
    }

    function decodeHash() {
        const h = location.hash;
        if (!h.startsWith("#m=")) return null;
        try {
            const raw = h.slice(3);
            const s = decodeURIComponent(escape(atob(raw)));
            return JSON.parse(s);
        } catch (_) {
            return null;
        }
    }

    function copyUrl() {
        const inc = appSettings.includeDoodlesInLinks;
        const payload = serializeForUrl(inc);
        const base =
            location.origin && location.origin !== "null"
                ? location.origin + location.pathname
                : location.href.replace(/#.*$/, "");
        const url = base + encodeHash(payload);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(
                () => playBeep(true),
                () => prompt("Copy this link:", url)
            );
        } else {
            prompt("Copy this link:", url);
        }
    }

    function loadFromPrompt() {
        const u = prompt("Paste a saved link:");
        if (!u) return;
        try {
            const hashIdx = u.indexOf("#m=");
            if (hashIdx < 0) throw new Error("no state");
            const raw = u.slice(hashIdx + 3);
            const s = decodeURIComponent(escape(atob(raw)));
            const obj = JSON.parse(s);
            applyFromSerialized(obj);
            playBeep(true);
        } catch (_) {
            alert("That link didn’t work — try another one.");
        }
    }

    async function init() {
        const loadingStartedAt = performance.now();
        els.stage = $("canvas-stage");
        applyAppSettings();
        await loadManifest();
        await preloadManifestImages();
        buildItemsPanel();
        bindTextStickerModal();
        bindLocalProjects();

        past.length = 0;
        future.length = 0;
        updateUndoRedo();

        applyBackground();
        resizePaintCanvas(true);
        bindPaintCanvas();

        document.documentElement.style.setProperty("--cursor-eraser", ERASER_CURSOR);
        setPaintToolActive(false);

        new ResizeObserver(() => {
            syncRects();
            resizePaintCanvas(true);
            renderStickers();
        }).observe($("canvas-stage"));

        $("canvas-stage").addEventListener("pointerdown", (e) => {
            if (e.target.closest(".sticker")) return;
            deselectAll();
        });

        $("btn-undo").addEventListener("click", undo);
        $("btn-redo").addEventListener("click", redo);

        $("layer-bigger").addEventListener("click", () =>
            transformSelected((it) => {
                it.scale = Math.min(3.2, it.scale * 1.12);
            })
        );
        $("layer-smaller").addEventListener("click", () =>
            transformSelected((it) => {
                it.scale = Math.max(0.35, it.scale / 1.12);
            })
        );
        $("layer-rot-left").addEventListener("click", () =>
            transformSelected((it) => {
                it.rotation -= 15;
            })
        );
        $("layer-rot-right").addEventListener("click", () =>
            transformSelected((it) => {
                it.rotation += 15;
            })
        );
        $("layer-delete").addEventListener("click", () => deleteSelectedLayer());

        $("btn-settings").addEventListener("click", () => {
            $("settings-modal").classList.remove("hidden");
            setProjectStatus("");
            refreshProjectGallery();
        });
        $("settings-close").addEventListener("click", () => {
            $("settings-modal").classList.add("hidden");
        });
        $("settings-modal").addEventListener("click", (e) => {
            if (e.target === $("settings-modal")) $("settings-modal").classList.add("hidden");
        });

        $("setting-theme").addEventListener("change", (e) => {
            updateAppSetting("theme", e.target.value);
        });
        $("setting-sound").addEventListener("change", (e) => {
            updateAppSetting("sound", e.target.checked);
        });
        $("setting-url-paint").addEventListener("change", (e) => {
            updateAppSetting("includeDoodlesInLinks", e.target.checked);
        });
        $("setting-two-finger").addEventListener("change", (e) => {
            updateAppSetting("twoFingerGestures", e.target.checked);
        });

        $("btn-copy-url").addEventListener("click", copyUrl);
        $("btn-load-url").addEventListener("click", loadFromPrompt);

        const explodeBtn = $("btn-explode-clear");
        if (explodeBtn) explodeBtn.addEventListener("click", () => runExplosiveClear());

        const fromHash = decodeHash();
        if (fromHash) {
            applyFromSerialized(fromHash);
        } else {
            await restoreAutosave();
        }

        syncRects();
        renderStickers();
        renderLayers();
        autosaveEnabled = true;
        scheduleAutosave(1200);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushAutosave().catch(() => {});
        });
        window.addEventListener("pagehide", () => {
            flushAutosave().catch(() => {});
        });

        await finishLoadingOverlay(loadingStartedAt);
    }

    init().catch(() => {
        setLoadingMessage("The socks escaped! Reload to try again.");
        const dots = document.querySelector(".loading-dots");
        if (dots) dots.hidden = true;
    });
})();
