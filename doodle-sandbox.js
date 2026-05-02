(function () {
    const TOOLS = [
        {
            id: "stamp",
            name: "1 · Stamp trail",
            desc: "Small shapes repeat along the drag path.",
            hint: "Drag slowly for even stamps."
        },
        {
            id: "neon",
            name: "2 · Neon glow",
            desc: "Soft outer halo plus bright core line.",
            hint: "Try thick slow curves."
        },
        {
            id: "pattern",
            name: "3 · Pattern fill pen",
            desc: "Stripes clipped inside each blob along the stroke.",
            hint: "Medium spacing between blobs."
        },
        {
            id: "ribbon",
            name: "4 · Twin ribbon",
            desc: "Two parallel lines that follow your motion.",
            hint: "Wiggle for ribbon folds."
        },
        {
            id: "confetti",
            name: "5 · Confetti burst",
            desc: "Each tap drops a static burst of tiny tiles.",
            hint: "Tap repeatedly; rainbow randomizes flecks."
        },
        {
            id: "pearls",
            name: "6 · Pearls / beads",
            desc: "Linked circles like a bead chain.",
            hint: "Drag smoothly for a necklace."
        },
        {
            id: "fur",
            name: "7 · Fur / grass",
            desc: "Short hairs stick out sideways from the stroke.",
            hint: "Zig-zag for fuzzy patches."
        },
        {
            id: "scratch",
            name: "8 · Scratch rainbow",
            desc: "Black wax layer; scratch to reveal rainbow underneath.",
            hint: "Switch tools to flatten layers onto one canvas."
        },
        {
            id: "mirror",
            name: "9 · Symmetry mirror",
            desc: "Each stroke is mirrored horizontally across the canvas.",
            hint: "Draw on one side; the other mirrors."
        },
        {
            id: "smudge",
            name: "10 · Smudge blend",
            desc: "Soft finger-push by sampling and shifting the canvas.",
            hint: "Layer strokes to blend colors."
        },
        {
            id: "ants",
            name: "11 · Marching ants",
            desc: "Dashed line follows your stroke (animated while drawing).",
            hint: "On release, the path commits as a static dashed line."
        },
        {
            id: "shapespray",
            name: "12 · Shape spray",
            desc: "Spray of tiny rotated squares and triangles.",
            hint: "Rainbow uses random hue per fleck."
        }
    ];

    const wrap = document.getElementById("canvas-wrap");
    let cv = document.getElementById("cv");
    const toolsEl = document.getElementById("tools");
    const hintEl = document.getElementById("hint");
    const optRainbow = document.getElementById("opt-rainbow");
    const optColor = document.getElementById("opt-color");
    const btnClear = document.getElementById("btn-clear");

    let ctx = null;
    let W = 920;
    let H = 520;
    let dpr = 1;
    let currentTool = TOOLS[0].id;
    let painting = false;
    let last = null;
    let pearlsLast = null;
    let stampLast = null;
    let marchSnapshot = null;
    let marchPoints = [];
    let scratch = { base: null, top: null, ctxB: null, ctxT: null };
    let rafAnts = null;
    let stripePattern = null;

    function strokeStyleAt(lx, ly, sprayRand) {
        if (optRainbow.checked) {
            if (sprayRand) {
                return "hsl(" + ((Math.random() * 360) | 0) + ", 88%, 58%)";
            }
            const hue = (lx * 2.4 + ly * 2.4 + performance.now() * 0.06) % 360;
            return "hsl(" + hue + ", 90%, 55%)";
        }
        return optColor.value;
    }

    function ensureMainCanvas() {
        if (!scratch.base) {
            cv = document.getElementById("cv");
            if (cv) ctx = cv.getContext("2d");
        }
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = wrap.getBoundingClientRect();
        const cssW = Math.max(320, Math.floor(rect.width));
        const cssH = Math.floor((cssW * 520) / 920);
        W = cssW;
        H = cssH;
        stripePattern = null;
        if (scratch.base) {
            setupScratchLayers(true);
            return;
        }
        ensureMainCanvas();
        if (!cv || !ctx) return;
        cv.width = Math.floor(W * dpr);
        cv.height = Math.floor(H * dpr);
        cv.style.width = W + "px";
        cv.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#fffef8";
        ctx.fillRect(0, 0, W, H);
    }

    function clearCanvas() {
        cancelAnimationFrame(rafAnts);
        rafAnts = null;
        if (scratch.base) {
            teardownScratch();
        }
        ensureMainCanvas();
        if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = "#fffef8";
            ctx.fillRect(0, 0, W, H);
        }
        marchSnapshot = null;
        marchPoints = [];
        stripePattern = null;
    }

    function teardownScratch() {
        wrap.classList.remove("scratch-stack");
        wrap.innerHTML = "";
        const c = document.createElement("canvas");
        c.id = "cv";
        wrap.appendChild(c);
        cv = c;
        scratch = { base: null, top: null, ctxB: null, ctxT: null };
        resize();
    }

    function fillRainbowNoise(c2) {
        const img = c2.createImageData(W, H);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const hue = (Math.random() * 360) | 0;
            const s = 0.75 + Math.random() * 0.22;
            const l = 0.52 + Math.random() * 0.18;
            const [r, g, b] = hslToRgb(hue / 360, s, l);
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = 255;
        }
        c2.putImageData(img, 0, 0);
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hueToRgb(p, q, h + 1 / 3);
            g = hueToRgb(p, q, h);
            b = hueToRgb(p, q, h - 1 / 3);
        }
        return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
    }

    function hueToRgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }

    function setupScratchLayers(isResize) {
        if (!scratch.base && !isResize) {
            wrap.classList.add("scratch-stack");
            wrap.innerHTML = "";
            const base = document.createElement("canvas");
            const top = document.createElement("canvas");
            base.className = "scratch-layer base";
            top.className = "scratch-layer top";
            wrap.appendChild(base);
            wrap.appendChild(top);
            scratch.base = base;
            scratch.top = top;
        }
        const base = scratch.base;
        const top = scratch.top;
        if (!base || !top) return;
        [base, top].forEach((c) => {
            c.width = Math.floor(W * dpr);
            c.height = Math.floor(H * dpr);
            c.style.width = W + "px";
            c.style.height = H + "px";
        });
        scratch.ctxB = base.getContext("2d");
        scratch.ctxT = top.getContext("2d");
        scratch.ctxB.setTransform(dpr, 0, 0, dpr, 0, 0);
        scratch.ctxT.setTransform(dpr, 0, 0, dpr, 0, 0);
        fillRainbowNoise(scratch.ctxB);
        scratch.ctxT.globalCompositeOperation = "source-over";
        scratch.ctxT.fillStyle = "#1a1a1e";
        scratch.ctxT.fillRect(0, 0, W, H);
        scratch.ctxT.globalCompositeOperation = "destination-out";
        top.style.pointerEvents = "auto";
        base.style.pointerEvents = "none";
    }

    function switchTool(id) {
        if (id === "scratch") {
            if (currentTool !== "scratch") {
                currentTool = id;
                setupScratchLayers(false);
            }
            updateHint();
            return;
        }
        if (currentTool === "scratch") {
            mergeScratchToMain();
        }
        currentTool = id;
        ensureMainCanvas();
        updateHint();
    }

    function mergeScratchToMain() {
        if (!scratch.base) return;
        const imageB = scratch.base;
        const imageT = scratch.top;
        teardownScratch();
        ensureMainCanvas();
        ctx.drawImage(imageB, 0, 0, W, H);
        ctx.drawImage(imageT, 0, 0, W, H);
    }

    function clientToLocal(clientX, clientY) {
        const el = scratch.ctxT ? scratch.top : cv;
        const r = el.getBoundingClientRect();
        return { x: clientX - r.left, y: clientY - r.top };
    }

    function drawStamp(cx, cy, col) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = col;
        const s = 11;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.9);
        ctx.bezierCurveTo(s, -s * 0.3, s * 0.4, s * 0.95, 0, s * 0.55);
        ctx.bezierCurveTo(-s * 0.4, s * 0.95, -s, -s * 0.3, 0, -s * 0.9);
        ctx.fill();
        ctx.restore();
    }

    function getStripePattern() {
        if (stripePattern) return stripePattern;
        const p = document.createElement("canvas");
        p.width = 12;
        p.height = 12;
        const pctx = p.getContext("2d");
        pctx.fillStyle = "#fff";
        pctx.fillRect(0, 0, 12, 12);
        pctx.strokeStyle = "#888";
        pctx.lineWidth = 2;
        pctx.beginPath();
        pctx.moveTo(-2, 14);
        pctx.lineTo(14, -2);
        pctx.stroke();
        stripePattern = ctx.createPattern(p, "repeat");
        return stripePattern;
    }

    function segmentNeon(x0, y0, x1, y1, col) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    }

    function segmentRibbon(x0, y0, x1, y1, col) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = (-dy / len) * 5;
        const ny = (dx / len) * 5;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0 + nx, y0 + ny);
        ctx.lineTo(x1 + nx, y1 + ny);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0 - nx, y0 - ny);
        ctx.lineTo(x1 - nx, y1 - ny);
        ctx.stroke();
    }

    function segmentPearl(x, y, col, radius, drawLink) {
        if (drawLink && pearlsLast) {
            ctx.strokeStyle = col;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(pearlsLast.x, pearlsLast.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        pearlsLast = { x, y };
    }

    function sprayFur(x0, y0, x1, y1, col) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        const steps = Math.max(2, Math.ceil(len / 6));
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const cx = x0 + dx * t;
            const cy = y0 + dy * t;
            for (let k = 0; k < 10; k++) {
                const side = Math.random() < 0.5 ? 1 : -1;
                const spread = 4 + Math.random() * 10;
                const jitter = (Math.random() - 0.5) * 4;
                const x = cx + px * spread * side + jitter * py;
                const y = cy + py * spread * side + jitter * px;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    }

    function drawConfettiBurst(x, y) {
        const n = 48;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * 42;
            const px = x + Math.cos(a) * d;
            const py = y + Math.sin(a) * d;
            const col = optRainbow.checked
                ? "hsl(" + ((Math.random() * 360) | 0) + ", 88%, 58%)"
                : optColor.value;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(Math.random() * Math.PI);
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.75 + Math.random() * 0.25;
            ctx.fillRect(-2.5, -1.8, 5, 3.6);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    function smudgeAt(x, y) {
        const s = 36;
        ctx.save();
        ctx.globalAlpha = 0.22;
        try {
            ctx.drawImage(cv, x - s / 2, y - s / 2, s, s, x - s / 2 + 4, y - s / 2 - 2, s, s);
        } catch (_) {}
        ctx.restore();
    }

    function shapeSpray(lx, ly) {
        const r = 26;
        const n = 22;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * r;
            const px = lx + Math.cos(a) * d;
            const py = ly + Math.sin(a) * d;
            const col = strokeStyleAt(px, py, true);
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(Math.random() * Math.PI);
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.55;
            if (Math.random() < 0.5) {
                ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
            } else {
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(2.8, 2.6);
                ctx.lineTo(-2.8, 2.6);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    function withMirror(fn) {
        const mw = W / 2;
        ctx.save();
        fn();
        ctx.translate(2 * mw, 0);
        ctx.scale(-1, 1);
        fn();
        ctx.restore();
    }

    function paintPatternBlob(cx, cy, col) {
        const pat = getStripePattern();
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.clip();
        ctx.translate(cx - 16, cy - 16);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, 32, 32);
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function marchRedrawLive() {
        if (!marchSnapshot || marchPoints.length < 2) return;
        ctx.putImageData(marchSnapshot, 0, 0);
        ctx.strokeStyle = strokeStyleAt(marchPoints[0].x, marchPoints[0].y, false);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -(performance.now() / 40) % 14;
        ctx.beginPath();
        ctx.moveTo(marchPoints[0].x, marchPoints[0].y);
        for (let i = 1; i < marchPoints.length; i++) {
            ctx.lineTo(marchPoints[i].x, marchPoints[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
    }

    function commitMarchPath() {
        if (!marchSnapshot || marchPoints.length < 2) return;
        ctx.putImageData(marchSnapshot, 0, 0);
        ctx.strokeStyle = strokeStyleAt(marchPoints[0].x, marchPoints[0].y, false);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = 0;
        ctx.beginPath();
        ctx.moveTo(marchPoints[0].x, marchPoints[0].y);
        for (let i = 1; i < marchPoints.length; i++) {
            ctx.lineTo(marchPoints[i].x, marchPoints[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function startAntsLoop() {
        cancelAnimationFrame(rafAnts);
        const tick = () => {
            if (currentTool !== "ants" || !painting || !marchSnapshot) {
                rafAnts = null;
                return;
            }
            marchRedrawLive();
            rafAnts = requestAnimationFrame(tick);
        };
        rafAnts = requestAnimationFrame(tick);
    }

    function onPointerDown(e) {
        ensureMainCanvas();
        const { x, y } = clientToLocal(e.clientX, e.clientY);

        if (currentTool === "scratch") {
            painting = true;
            scratch.ctxT.beginPath();
            scratch.ctxT.arc(x, y, 14, 0, Math.PI * 2);
            scratch.ctxT.fillStyle = "#fff";
            scratch.ctxT.fill();
            last = { x, y };
            return;
        }

        painting = true;
        last = { x, y };
        stampLast = { x, y };
        pearlsLast = null;

        if (currentTool === "ants") {
            marchPoints = [{ x, y }];
            marchSnapshot = ctx.getImageData(0, 0, cv.width, cv.height);
            startAntsLoop();
        }

        if (currentTool === "confetti") {
            drawConfettiBurst(x, y);
        }

        if (currentTool === "pattern") {
            paintPatternBlob(x, y, strokeStyleAt(x, y, false));
        }
    }

    function onPointerMove(e) {
        if (!painting) return;
        ensureMainCanvas();
        const { x, y } = clientToLocal(e.clientX, e.clientY);

        if (currentTool === "scratch") {
            if (last) {
                const dx = x - last.x;
                const dy = y - last.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.max(1, Math.ceil(dist / 4));
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const sx = last.x + dx * t;
                    const sy = last.y + dy * t;
                    scratch.ctxT.beginPath();
                    scratch.ctxT.arc(sx, sy, 12, 0, Math.PI * 2);
                    scratch.ctxT.fillStyle = "#fff";
                    scratch.ctxT.fill();
                }
            }
            last = { x, y };
            return;
        }

        if (!last) return;

        if (currentTool === "stamp") {
            const d = Math.hypot(x - stampLast.x, y - stampLast.y);
            if (d >= 22) {
                drawStamp(x, y, strokeStyleAt(x, y, false));
                stampLast = { x, y };
            }
            last = { x, y };
            return;
        }

        if (currentTool === "neon") {
            segmentNeon(last.x, last.y, x, y, strokeStyleAt(x, y, false));
            last = { x, y };
            return;
        }

        if (currentTool === "pattern") {
            const d = Math.hypot(x - last.x, y - last.y);
            if (d >= 18) {
                paintPatternBlob(x, y, strokeStyleAt(x, y, false));
                last = { x, y };
            }
            return;
        }

        if (currentTool === "ribbon") {
            segmentRibbon(last.x, last.y, x, y, strokeStyleAt(x, y, false));
            last = { x, y };
            return;
        }

        if (currentTool === "pearls") {
            const d = Math.hypot(x - last.x, y - last.y);
            if (d >= 14) {
                segmentPearl(x, y, strokeStyleAt(x, y, false), 9, !!pearlsLast);
                last = { x, y };
            }
            return;
        }

        if (currentTool === "fur") {
            sprayFur(last.x, last.y, x, y, strokeStyleAt(x, y, false));
            last = { x, y };
            return;
        }

        if (currentTool === "mirror") {
            const col = strokeStyleAt(x, y, false);
            withMirror(() => {
                ctx.strokeStyle = col;
                ctx.lineWidth = 4;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(last.x, last.y);
                ctx.lineTo(x, y);
                ctx.stroke();
            });
            last = { x, y };
            return;
        }

        if (currentTool === "smudge") {
            const steps = Math.max(1, Math.ceil(Math.hypot(x - last.x, y - last.y) / 6));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                smudgeAt(last.x + (x - last.x) * t, last.y + (y - last.y) * t);
            }
            last = { x, y };
            return;
        }

        if (currentTool === "ants") {
            marchPoints.push({ x, y });
            last = { x, y };
            return;
        }

        if (currentTool === "shapespray") {
            const dx = x - last.x;
            const dy = y - last.y;
            const dist = Math.hypot(dx, dy);
            const steps = Math.max(1, Math.ceil(dist / 10));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = last.x + dx * t;
                const py = last.y + dy * t;
                shapeSpray(px, py);
            }
            last = { x, y };
            return;
        }

        if (currentTool === "confetti") {
            drawConfettiBurst(x, y);
            last = { x, y };
            return;
        }

        last = { x, y };
    }

    function onPointerUp() {
        if (currentTool === "scratch") {
            painting = false;
            last = null;
            return;
        }
        if (currentTool === "ants") {
            cancelAnimationFrame(rafAnts);
            rafAnts = null;
            commitMarchPath();
        }
        painting = false;
        last = null;
        pearlsLast = null;
        stampLast = null;
        marchSnapshot = null;
        marchPoints = [];
    }

    function bindUi() {
        TOOLS.forEach((t) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "tool-btn" + (t.id === currentTool ? " active" : "");
            b.innerHTML =
                '<span class="name">' +
                t.name +
                '</span><span class="desc">' +
                t.desc +
                "</span>";
            b.addEventListener("click", () => {
                toolsEl.querySelectorAll(".tool-btn").forEach((x) => x.classList.remove("active"));
                b.classList.add("active");
                switchTool(t.id);
            });
            toolsEl.appendChild(b);
        });
        btnClear.addEventListener("click", clearCanvas);
    }

    function updateHint() {
        const t = TOOLS.find((x) => x.id === currentTool);
        hintEl.textContent = t ? t.hint : "";
    }

    function bindCanvas() {
        const target = () => (scratch.ctxT ? scratch.top : cv);
        wrap.addEventListener("pointerdown", (e) => {
            if (e.target !== cv && e.target !== scratch.top) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            onPointerDown(e);
        });
        wrap.addEventListener("pointermove", (e) => {
            if (!painting) return;
            onPointerMove(e);
        });
        wrap.addEventListener("pointerup", (e) => {
            onPointerUp();
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (_) {}
        });
        wrap.addEventListener("pointercancel", onPointerUp);
    }

    window.addEventListener("resize", resize);

    bindUi();
    bindCanvas();
    resize();
    updateHint();
})();
