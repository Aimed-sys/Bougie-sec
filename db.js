/* =========================================================
   COUCHE BASE DE DONNÉES — BougieSec
   ---------------------------------------------------------
   Deux modes, choisis automatiquement d'après config.js :
   - "supabase" : produits + commandes dans une vraie base partagée
   - "local"    : tout est gardé dans le navigateur (test uniquement)
   Aucune librairie externe : on parle directement à l'API REST.
========================================================= */
const DB = (function () {

    const cfg = window.BOUGIESEC_CONFIG || {};
    const enabled = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
    const base = enabled ? cfg.SUPABASE_URL.replace(/\/+$/, "") : "";

    const SESSION_KEY = "bougiesec_admin_session";
    const LOCAL_ORDERS_KEY = "bougiesec_orders_v1";
    const LOCAL_PRODUCTS_KEY = "bougiesec_products_v2";

    /* ---------- Session administrateur (Supabase Auth) ---------- */

    function readSession() {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
        catch (e) { return null; }
    }

    function writeSession(data) {
        const session = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600)
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    async function authRequest(grantType, body) {
        const res = await fetch(`${base}/auth/v1/token?grant_type=${grantType}`, {
            method: "POST",
            headers: { "apikey": cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            let info = {};
            try { info = await res.json(); } catch (e) { /* réponse vide */ }
            const error = new Error("auth");
            error.status = res.status;
            error.code = info.error_code || info.error || "";
            error.detail = info.msg || info.error_description || "";
            throw error;
        }
        return res.json();
    }

    async function signIn(email, password) {
        const data = await authRequest("password", { email, password });
        writeSession(data);
    }

    function signOut() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    async function getToken() {
        let session = readSession();
        if (!session) throw new Error("not-signed-in");

        // Renouvelle le jeton quelques secondes avant son expiration
        if (session.expires_at - 30 < Math.floor(Date.now() / 1000)) {
            try {
                const data = await authRequest("refresh_token", { refresh_token: session.refresh_token });
                session = writeSession(data);
            } catch (e) {
                signOut();
                throw new Error("not-signed-in");
            }
        }
        return session.access_token;
    }

    function hasSession() {
        return Boolean(readSession());
    }

    /* ---------- Requêtes REST ---------- */

    async function rest(path, options = {}) {
        const { method = "GET", body, admin = false, prefer } = options;

        const headers = { "apikey": cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
        if (admin) headers["Authorization"] = `Bearer ${await getToken()}`;
        if (prefer) headers["Prefer"] = prefer;

        const res = await fetch(`${base}/rest/v1/${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            const error = new Error(`Erreur ${res.status}`);
            error.status = res.status;
            error.detail = detail;
            throw error;
        }

        if (res.status === 204) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    /* ---------- Stockage local (mode test) ---------- */

    function localRead(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }

    function localWrite(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (e) { return false; }
    }

    function newId() {
        return (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : "local-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    }

    /* ---------- Produits ---------- */

    // Renvoie la liste enregistrée, ou null si rien n'a encore été enregistré.
    async function listProducts() {
        if (enabled) {
            const rows = await rest("products?select=*&order=position.asc");
            return rows && rows.length ? rows : null;
        }
        const saved = localRead(LOCAL_PRODUCTS_KEY, null);
        return Array.isArray(saved) && saved.length ? saved : null;
    }

    async function saveProducts(products, deletedIds = []) {
        const rows = products.map((p, index) => ({
            id: p.id,
            category: p.category,
            name: p.name,
            price: (p.price === null || p.price === "" || isNaN(Number(p.price))) ? null : Number(p.price),
            availability: p.availability,
            position: index,
            updated_at: new Date().toISOString()
        }));

        if (enabled) {
            await rest("products?on_conflict=id", {
                method: "POST", admin: true, body: rows,
                prefer: "resolution=merge-duplicates,return=minimal"
            });
            for (const id of deletedIds) {
                await rest(`products?id=eq.${encodeURIComponent(id)}`, {
                    method: "DELETE", admin: true, prefer: "return=minimal"
                });
            }
            return true;
        }
        return localWrite(LOCAL_PRODUCTS_KEY, rows);
    }

    /* ---------- Commandes ---------- */

    // Appelée par le site public : enregistre une demande / commande.
    async function saveOrder(order) {
        if (enabled) {
            await rest("orders", { method: "POST", body: order, prefer: "return=minimal" });
            return;
        }
        const orders = localRead(LOCAL_ORDERS_KEY, []);
        orders.unshift({ id: newId(), created_at: new Date().toISOString(), status: "nouveau", admin_note: null, ...order });
        localWrite(LOCAL_ORDERS_KEY, orders);
    }

    async function listOrders() {
        if (enabled) {
            return await rest("orders?select=*&order=created_at.desc&limit=1000", { admin: true });
        }
        return localRead(LOCAL_ORDERS_KEY, []);
    }

    async function updateOrder(id, changes) {
        if (enabled) {
            await rest(`orders?id=eq.${encodeURIComponent(id)}`, {
                method: "PATCH", admin: true, body: changes, prefer: "return=minimal"
            });
            return;
        }
        const orders = localRead(LOCAL_ORDERS_KEY, []);
        const index = orders.findIndex((o) => o.id === id);
        if (index !== -1) {
            orders[index] = { ...orders[index], ...changes };
            localWrite(LOCAL_ORDERS_KEY, orders);
        }
    }

    async function deleteOrder(id) {
        if (enabled) {
            await rest(`orders?id=eq.${encodeURIComponent(id)}`, {
                method: "DELETE", admin: true, prefer: "return=minimal"
            });
            return;
        }
        const orders = localRead(LOCAL_ORDERS_KEY, []).filter((o) => o.id !== id);
        localWrite(LOCAL_ORDERS_KEY, orders);
    }

    return {
        enabled,
        mode: enabled ? "supabase" : "local",
        adminEmail: cfg.ADMIN_EMAIL || "",
        signIn, signOut, hasSession,
        listProducts, saveProducts,
        saveOrder, listOrders, updateOrder, deleteOrder
    };
})();
