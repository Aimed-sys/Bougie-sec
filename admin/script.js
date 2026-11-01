/* =========================================================
   ADMINISTRATION BougieSec
   - Commandes : liste, recherche, statuts, notes, export CSV
   - Produits  : nom, prix, disponibilité, ajout / suppression

   CONNEXION
   - Mode "supabase" (config.js rempli) : le mot de passe est vérifié
     par Supabase (compte administrateur). Rien n'est écrit dans ce fichier.
   - Mode "local" (test, config.js vide) : mot de passe ci-dessous.
     ⚠ Il est visible dans le code : à n'utiliser que pour tester.
========================================================= */

const LOCAL_ADMIN_PASSWORD = "18062008";
const LOCAL_FLAG = "bougiesec_admin_local";

const STATUS_LABELS = {
    nouveau: "Nouvelle",
    en_cours: "En cours",
    traite: "Traitée",
    annule: "Annulée"
};

const WHATSAPP_NUMBER_ADMIN = "213652264394";

/* ---------- Outils ---------- */

const $ = (selector) => document.querySelector(selector);

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return { day: "—", time: "" };
    return {
        day: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
        time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    };
}

function formatDA(amount) {
    return `${Math.round(amount).toLocaleString("fr-FR")} DA`;
}

// Numéro algérien saisi à la française (0652…) → format international pour wa.me
function toInternational(phone) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = "213" + digits.slice(1);
    return digits;
}

let toastTimer;
function toast(message, isError = false) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.toggle("is-error", isError);
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), isError ? 6000 : 3200);
}

function describeError(err) {
    if (!err) return "Erreur inconnue.";
    if (err.status === 401 || err.status === 403 || err.message === "not-signed-in") {
        return "Accès refusé : reconnectez-vous, ou vérifiez les règles de sécurité de la base (voir supabase-setup.sql).";
    }
    if (err.status === 404) {
        return "Table introuvable : exécutez le fichier supabase-setup.sql dans Supabase (SQL Editor).";
    }
    return `Erreur ${err.status || ""} ${err.detail ? "— " + err.detail.slice(0, 160) : ""}`.trim();
}


/* =========================================================
   CONNEXION
========================================================= */

const loginScreen = $("#login-screen");
const appEl = $("#app");

function isLoggedIn() {
    return DB.enabled ? DB.hasSession() : sessionStorage.getItem(LOCAL_FLAG) === "1";
}

function showLoginError(message) {
    const el = $("#login-error");
    el.textContent = message;
    el.hidden = !message;
}

// En mode Supabase sans ADMIN_EMAIL dans config.js, on demande l'email
if (DB.enabled && !DB.adminEmail) {
    $("#email-field").hidden = false;
    $("#login-email").required = true;
}

$("#login-form").addEventListener("submit", async (event) => {

    event.preventDefault();
    showLoginError("");

    const password = $("#login-password").value;
    const submit = $("#login-submit");

    submit.disabled = true;
    submit.textContent = "Connexion…";

    try {
        if (DB.enabled) {
            const email = DB.adminEmail || $("#login-email").value.trim();
            await DB.signIn(email, password);
        } else {
            if (password !== LOCAL_ADMIN_PASSWORD) throw new Error("bad-password");
            sessionStorage.setItem(LOCAL_FLAG, "1");
        }

        $("#login-password").value = "";
        startApp();

    } catch (err) {
        if (err instanceof TypeError) {
            showLoginError("Impossible de joindre le serveur. Vérifiez votre connexion et config.js.");
        } else {
            showLoginError("Mot de passe incorrect.");
            $("#login-password").select();
        }
    } finally {
        submit.disabled = false;
        submit.textContent = "Se connecter";
    }
});

$("#logout").addEventListener("click", () => {
    DB.signOut();
    sessionStorage.removeItem(LOCAL_FLAG);
    clearInterval(refreshTimer);
    appEl.hidden = true;
    loginScreen.hidden = false;
    $("#login-password").focus();
});


/* =========================================================
   DÉMARRAGE
========================================================= */

let refreshTimer;

function startApp() {

    loginScreen.hidden = true;
    appEl.hidden = false;

    const pill = $("#mode-pill");
    const notice = $("#mode-notice");

    if (DB.enabled) {
        pill.textContent = "Base de données connectée";
        pill.className = "mode-pill is-online";
        notice.hidden = true;
    } else {
        pill.textContent = "Mode local (test)";
        pill.className = "mode-pill is-local";
        notice.hidden = false;
        notice.innerHTML = `Mode test : les commandes et produits sont gardés <strong>dans ce navigateur uniquement</strong>.
            Pour recevoir les commandes de tous vos visiteurs ici, renseignez <code>config.js</code> avec votre projet Supabase
            (voir LISEZMOI.md, section « Base de données »).`;
    }

    loadOrders();
    loadProducts();

    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
        if (!document.hidden && $("#panel-orders").hidden === false) loadOrders(true);
    }, 60000);
}

if (isLoggedIn()) {
    startApp();
} else {
    $("#login-password").focus();
}


/* =========================================================
   ONGLETS
========================================================= */

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {

        document.querySelectorAll(".tab").forEach((t) => {
            const active = t === tab;
            t.classList.toggle("is-active", active);
            t.setAttribute("aria-selected", String(active));
        });

        $("#panel-orders").hidden = tab.dataset.tab !== "orders";
        $("#panel-products").hidden = tab.dataset.tab !== "products";
    });
});


/* =========================================================
   COMMANDES
========================================================= */

let orders = [];

async function loadOrders(silent = false) {

    const errorEl = $("#orders-error");

    try {
        orders = await DB.listOrders();
        errorEl.hidden = true;
        renderOrders();
        renderStats();
    } catch (err) {
        console.error(err);
        errorEl.textContent = describeError(err);
        errorEl.hidden = false;
        if (err.status === 401 || err.message === "not-signed-in") {
            DB.signOut();
        }
    }
}

function renderStats() {

    const count = (status) => orders.filter((o) => o.status === status).length;
    const newCount = count("nouveau");

    $("#stats").innerHTML = `
        <div class="stat" style="--stat-color:var(--jute)"><strong>${newCount}</strong><span>Nouvelles</span></div>
        <div class="stat" style="--stat-color:var(--bleu)"><strong>${count("en_cours")}</strong><span>En cours</span></div>
        <div class="stat" style="--stat-color:var(--feuille)"><strong>${count("traite")}</strong><span>Traitées</span></div>
        <div class="stat" style="--stat-color:var(--noyer-mute)"><strong>${orders.length}</strong><span>Au total</span></div>
    `;

    const badge = $("#badge-new");
    badge.textContent = newCount;
    badge.hidden = newCount === 0;
}

function filteredOrders() {

    const query = $("#order-search").value.trim().toLowerCase();
    const status = $("#order-status-filter").value;
    const type = $("#order-type-filter").value;

    return orders.filter((o) => {
        if (status && o.status !== status) return false;
        if (type && o.type !== type) return false;
        if (!query) return true;

        const haystack = [
            o.lastname, o.firstname, o.phone, o.email, o.subject, o.message,
            ...(o.items || []).map((i) => i.name)
        ].join(" ").toLowerCase();

        return haystack.includes(query);
    });
}

function itemsSummary(order) {
    const items = order.items || [];
    if (items.length === 0) return `<span class="muted">Aucun produit (demande)</span>`;
    const shown = items.slice(0, 3).map((i) => `${esc(i.name)} — ${esc(i.format)} × ${i.quantity}`).join("<br>");
    const more = items.length > 3 ? `<br><span class="muted">+ ${items.length - 3} autre(s)</span>` : "";
    return shown + more;
}

function renderOrders() {

    const list = filteredOrders();
    const body = $("#orders-body");
    const empty = $("#orders-empty");

    const wrap = document.querySelector(".table-wrap");

    if (list.length === 0) {
        body.innerHTML = "";
        wrap.hidden = true;
        empty.hidden = false;
        empty.textContent = orders.length === 0
            ? "Aucune commande pour le moment. Elles apparaîtront ici dès qu'un visiteur enverra une demande depuis le site."
            : "Aucun résultat pour ces filtres.";
        return;
    }

    empty.hidden = true;
    wrap.hidden = false;

    body.innerHTML = list.map((o) => {

        const date = formatDate(o.created_at);
        const typeLabel = o.type === "commande" ? "Commande" : "Demande";

        return `
        <tr class="${o.status === "nouveau" ? "is-new" : ""}" data-id="${esc(o.id)}">
            <td class="cell-date" data-label="Date">${esc(date.day)}<small>${esc(date.time)}</small></td>
            <td class="cell-client" data-label="Client">
                <strong>${esc(o.firstname)} ${esc(o.lastname)}<span class="type-tag type-tag--${esc(o.type)}">${typeLabel}</span></strong>
                <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>
            </td>
            <td class="cell-products" data-label="Produits">${itemsSummary(o)}</td>
            <td data-label="Statut"><span class="status status--${esc(o.status)}">${esc(STATUS_LABELS[o.status] || o.status)}</span></td>
            <td class="col-actions">
                <div class="row-actions">
                    <button type="button" class="btn btn-primary btn-small" data-action="open">Ouvrir</button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

["#order-search", "#order-status-filter", "#order-type-filter"].forEach((sel) => {
    $(sel).addEventListener("input", renderOrders);
});

$("#orders-refresh").addEventListener("click", async () => {
    await loadOrders();
    toast("Liste actualisée.");
});

$("#orders-body").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    if (event.target.closest("a")) return; // laisse le lien tel: fonctionner
    openOrder(row.dataset.id);
});


/* ---------- Détail d'une commande ---------- */

const dialog = $("#order-dialog");
let currentOrderId = null;

function openOrder(id) {

    const order = orders.find((o) => String(o.id) === String(id));
    if (!order) return;

    currentOrderId = order.id;

    const date = formatDate(order.created_at);
    const items = order.items || [];
    const intl = toInternational(order.phone);

    const waText = `Bonjour ${order.firstname}, ici BougieSec. Nous revenons vers vous au sujet de votre demande${items.length ? " de commande" : ""}.`;
    const waUrl = `https://wa.me/${intl}?text=${encodeURIComponent(waText)}`;

    const itemsHtml = items.length === 0 ? "" : `
        <h3>Produits demandés</h3>
        <table class="items">
            <thead><tr><th>Produit</th><th>Format</th><th>Sacs</th><th>Disponibilité à l'envoi</th></tr></thead>
            <tbody>
                ${items.map((i) => `
                    <tr>
                        <td>${esc(i.name)}</td>
                        <td>${esc(i.format)}</td>
                        <td>${esc(i.quantity)}</td>
                        <td>${esc(i.availability || "")}</td>
                    </tr>`).join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2">Total</td>
                    <td>${esc(order.total_bags)}</td>
                    <td>≈ ${esc(order.total_weight)} kg${order.estimated_total ? ` · estimation ${esc(formatDA(order.estimated_total))}` : " · prix sur demande"}</td>
                </tr>
            </tfoot>
        </table>`;

    $("#dialog-content").innerHTML = `
        <div class="dialog-head">
            <div>
                <h2 id="dialog-title">${esc(order.firstname)} ${esc(order.lastname)}</h2>
                <p>${order.type === "commande" ? "Commande rapide" : "Demande de renseignements / devis"} · reçue le ${esc(date.day)} à ${esc(date.time)}</p>
            </div>
            <button type="button" class="icon-btn" data-dialog="close" aria-label="Fermer">✕</button>
        </div>

        <dl class="detail-grid">
            <div><dt>Téléphone</dt><dd><a href="tel:${esc(order.phone)}">${esc(order.phone)}</a></dd></div>
            <div><dt>Email</dt><dd>${order.email ? `<a href="mailto:${esc(order.email)}">${esc(order.email)}</a>` : "—"}</dd></div>
            <div><dt>Sujet</dt><dd>${esc(order.subject || "—")}</dd></div>
            <div><dt>Statut actuel</dt><dd><span class="status status--${esc(order.status)}">${esc(STATUS_LABELS[order.status] || order.status)}</span></dd></div>
        </dl>

        ${itemsHtml}

        ${order.message ? `<h3>Message du client</h3><div class="message-box">${esc(order.message)}</div>` : ""}

        <h3>Suivi</h3>
        <div class="dialog-form">
            <label>Statut
                <select id="dlg-status">
                    ${Object.entries(STATUS_LABELS).map(([value, label]) =>
                        `<option value="${value}"${order.status === value ? " selected" : ""}>${label}</option>`).join("")}
                </select>
            </label>
            <label>Note interne (visible seulement ici)
                <textarea id="dlg-note" placeholder="Ex. : devis envoyé, à rappeler mardi…">${esc(order.admin_note || "")}</textarea>
            </label>
        </div>

        <div class="dialog-actions">
            <button type="button" class="btn btn-danger" data-dialog="delete">Supprimer</button>
            <div class="group-right">
                <a class="btn btn-wa" href="${esc(waUrl)}" target="_blank" rel="noopener">Répondre sur WhatsApp</a>
                <button type="button" class="btn btn-primary" data-dialog="save">Enregistrer</button>
            </div>
        </div>
    `;

    if (!dialog.open) dialog.showModal();
}

dialog.addEventListener("click", async (event) => {

    // Clic sur le fond sombre : fermer
    if (event.target === dialog) { dialog.close(); return; }

    const action = event.target.closest("[data-dialog]")?.dataset.dialog;
    if (!action) return;

    if (action === "close") {
        dialog.close();
        return;
    }

    if (action === "save") {
        const button = event.target.closest("button");
        button.disabled = true;
        try {
            await DB.updateOrder(currentOrderId, {
                status: $("#dlg-status").value,
                admin_note: $("#dlg-note").value.trim() || null
            });
            dialog.close();
            await loadOrders(true);
            toast("Commande mise à jour.");
        } catch (err) {
            console.error(err);
            toast(describeError(err), true);
            button.disabled = false;
        }
        return;
    }

    if (action === "delete") {
        if (!confirm("Supprimer définitivement cette commande ? Cette action est irréversible.")) return;
        try {
            await DB.deleteOrder(currentOrderId);
            dialog.close();
            await loadOrders(true);
            toast("Commande supprimée.");
        } catch (err) {
            console.error(err);
            toast(describeError(err), true);
        }
    }
});


/* ---------- Export CSV ---------- */

$("#orders-export").addEventListener("click", () => {

    const list = filteredOrders();
    if (list.length === 0) { toast("Rien à exporter avec ces filtres.", true); return; }

    const header = ["Date", "Type", "Nom", "Prénom", "Téléphone", "Email", "Sujet", "Produits", "Sacs", "Poids (kg)", "Estimation (DA)", "Statut", "Note interne", "Message"];

    const cell = (value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

    const rows = list.map((o) => [
        new Date(o.created_at).toLocaleString("fr-FR"),
        o.type === "commande" ? "Commande" : "Demande",
        o.lastname, o.firstname, o.phone, o.email, o.subject,
        (o.items || []).map((i) => `${i.name} ${i.format} x${i.quantity}`).join(" | "),
        o.total_bags, o.total_weight, o.estimated_total,
        STATUS_LABELS[o.status] || o.status,
        o.admin_note, o.message
    ].map(cell).join(";"));

    // \uFEFF : permet à Excel d'afficher correctement les accents
    const csv = "\uFEFF" + [header.map(cell).join(";"), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `commandes-bougiesec-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});


/* =========================================================
   PRODUITS
========================================================= */

let products = [];
let deletedProductIds = [];
let productsDirty = false;

function setDirty(value) {
    productsDirty = value;
    $("#badge-dirty").hidden = !value;
}

async function loadProducts() {

    try {
        const saved = await DB.listProducts();

        if (saved) {
            products = saved.map((p) => ({ ...p }));
            setDirty(false);
        } else {
            // Rien d'enregistré dans la base : on propose le catalogue par défaut
            products = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
            setDirty(DB.enabled); // en ligne : à enregistrer une première fois
        }
    } catch (err) {
        console.error(err);
        products = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
        toast(describeError(err), true);
    }

    deletedProductIds = [];
    renderProducts();
}

// Remplit la liste des catégories du formulaire d'ajout
$("#new-category").innerHTML = CATEGORIES
    .map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("");

function renderProducts() {

    $("#products-groups").innerHTML = CATEGORIES.map((cat) => {

        const list = products.filter((p) => p.category === cat.id);
        if (list.length === 0) return "";

        const rows = list.map((p) => `
            <div class="product-row${p.availability === "indisponible" ? " is-unavailable" : ""}" data-id="${esc(p.id)}">
                <input type="text" data-field="name" value="${esc(p.name)}" aria-label="Nom du produit">
                <div class="price-input">
                    <input type="number" data-field="price" min="0" step="1" value="${p.price ?? ""}" placeholder="Sur demande" aria-label="Prix en DA par kg pour ${esc(p.name)}">
                </div>
                <select data-field="availability" aria-label="Disponibilité de ${esc(p.name)}">
                    ${Object.entries(AVAILABILITY_LABELS).map(([value, label]) =>
                        `<option value="${value}"${p.availability === value ? " selected" : ""}>${label}</option>`).join("")}
                </select>
                <button type="button" class="btn btn-danger btn-small" data-action="remove-product">Supprimer</button>
            </div>`).join("");

        return `
            <div class="group">
                <h3>${cat.emoji} ${esc(cat.label)} <small>${list.length} produit${list.length > 1 ? "s" : ""}</small></h3>
                ${rows}
            </div>`;
    }).join("");
}

$("#products-groups").addEventListener("input", (event) => {

    const row = event.target.closest(".product-row");
    const field = event.target.dataset.field;
    if (!row || !field) return;

    const product = products.find((p) => p.id === row.dataset.id);
    if (!product) return;

    if (field === "price") {
        product.price = event.target.value === "" ? null : Number(event.target.value);
    } else {
        product[field] = event.target.value;
    }

    if (field === "availability") {
        row.classList.toggle("is-unavailable", product.availability === "indisponible");
    }

    setDirty(true);
});

$("#products-groups").addEventListener("click", (event) => {

    const button = event.target.closest('[data-action="remove-product"]');
    if (!button) return;

    const row = button.closest(".product-row");
    const product = products.find((p) => p.id === row.dataset.id);
    if (!product) return;

    if (!confirm(`Retirer « ${product.name} » du catalogue ?`)) return;

    products = products.filter((p) => p.id !== product.id);
    deletedProductIds.push(product.id);
    setDirty(true);
    renderProducts();
});

function slugify(text) {
    return text
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produit";
}

$("#add-product-form").addEventListener("submit", (event) => {

    event.preventDefault();

    const name = $("#new-name").value.trim();
    if (!name) return;

    let id = slugify(name);
    const baseId = id;
    let n = 2;
    while (products.some((p) => p.id === id)) id = `${baseId}-${n++}`;

    const priceRaw = $("#new-price").value;

    products.push({
        id,
        category: $("#new-category").value,
        name,
        price: priceRaw === "" ? null : Number(priceRaw),
        availability: $("#new-availability").value
    });

    // Un produit qu'on avait retiré puis rajouté ne doit pas être supprimé à l'enregistrement
    deletedProductIds = deletedProductIds.filter((d) => d !== id);

    $("#add-product-form").reset();
    setDirty(true);
    renderProducts();
    toast("Produit ajouté — pensez à cliquer sur Enregistrer.");
});

$("#products-save").addEventListener("click", async () => {

    const empty = products.find((p) => !String(p.name).trim());
    if (empty) { toast("Un produit n'a pas de nom.", true); return; }

    const button = $("#products-save");
    button.disabled = true;
    button.textContent = "Enregistrement…";

    try {
        const ok = await DB.saveProducts(products, deletedProductIds);
        if (ok === false) throw new Error("Stockage impossible");
        deletedProductIds = [];
        setDirty(false);
        toast("Catalogue enregistré : le site est à jour.");
    } catch (err) {
        console.error(err);
        toast(describeError(err), true);
    } finally {
        button.disabled = false;
        button.textContent = "Enregistrer";
    }
});

$("#products-reset").addEventListener("click", () => {

    if (!confirm("Rétablir le catalogue par défaut ? Vos modifications non enregistrées seront perdues (rien n'est enregistré tant que vous ne cliquez pas sur Enregistrer).")) return;

    const defaults = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
    const defaultIds = new Set(defaults.map((p) => p.id));

    // Les produits ajoutés à la main seront supprimés à l'enregistrement
    deletedProductIds = [...new Set([
        ...deletedProductIds.filter((id) => !defaultIds.has(id)),
        ...products.filter((p) => !defaultIds.has(p.id)).map((p) => p.id)
    ])];

    products = defaults;
    setDirty(true);
    renderProducts();
});

window.addEventListener("beforeunload", (event) => {
    if (productsDirty) { event.preventDefault(); event.returnValue = ""; }
});
