/* =========================================================
   NUMÉRO WHATSAPP DE L'ENTREPRISE
========================================================= */

const WHATSAPP_NUMBER = "213652264394"; // +213 652 26 43 94, sans le "+"
const BAG_FORMATS = ["1 kg", "5 kg", "10 kg", "25 kg", "50 kg"];


/* =========================================================
   OUTILS
========================================================= */

// Échappe le texte venant du catalogue / de la base avant de l'insérer dans le HTML
function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function hasPrice(product) {
    return product.price !== null && product.price !== "" && !isNaN(Number(product.price));
}

function formatDA(amount) {
    return `${Math.round(amount).toLocaleString("fr-FR")} DA`;
}

function priceLabel(product) {
    return hasPrice(product) ? `${formatDA(product.price)} / kg` : "Prix sur demande";
}

function availabilityClass(availability) {
    return availability === "disponible" ? "available"
        : availability === "limite" ? "limited" : "unavailable";
}


/* =========================================================
   CATALOGUE : état + affichage
   - catalogue : la liste des produits (base de données ou valeurs par défaut)
   - selection : ce que le visiteur a choisi, par id de produit
========================================================= */

let catalogue = [];
const selection = {};            // { "lentilles-corail": { format: "5 kg", quantity: 2 } }
const openCategories = new Set();
let firstRenderDone = false;

const orderCategoriesEl = document.getElementById("order-categories");

function renderOrderList() {

    if (!orderCategoriesEl) return;

    // À la première fois, on ouvre les catégories qui ont au moins un produit disponible
    if (!firstRenderDone) {
        CATEGORIES.forEach((cat) => {
            const hasAvailable = catalogue.some(
                (p) => p.category === cat.id && p.availability !== "indisponible"
            );
            if (hasAvailable) openCategories.add(cat.id);
        });
        firstRenderDone = true;
    }

    orderCategoriesEl.innerHTML = CATEGORIES.map((cat) => {

        const products = catalogue.filter((p) => p.category === cat.id);
        if (products.length === 0) return "";

        const availableCount = products.filter((p) => p.availability !== "indisponible").length;
        const isOpen = openCategories.has(cat.id);

        const rows = products.map((product) => {

            const unavailable = product.availability === "indisponible";
            const chosen = selection[product.id] || { format: "", quantity: "" };

            const options = BAG_FORMATS.map((f) =>
                `<option value="${f}"${chosen.format === f ? " selected" : ""}>${f}</option>`
            ).join("");

            return `
                <div class="order-product${unavailable ? " order-product--disabled" : ""}" data-product-id="${esc(product.id)}">
                    <div class="order-product-info">
                        <strong>${esc(product.name)}</strong>
                        <span class="availability ${availabilityClass(product.availability)}">${esc(AVAILABILITY_LABELS[product.availability] || product.availability)}</span>
                        <span class="product-price">${esc(priceLabel(product))}</span>
                    </div>
                    <div class="order-controls">
                        <select aria-label="Format de sac pour ${esc(product.name)}"${unavailable ? " disabled" : ""}>
                            <option value="">Format</option>
                            ${options}
                        </select>
                        <input type="number" min="1" placeholder="Qté" aria-label="Nombre de sacs pour ${esc(product.name)}" value="${chosen.quantity || ""}"${unavailable ? " disabled" : ""}>
                        <span class="quantity-label">sac(s)</span>
                    </div>
                </div>`;
        }).join("");

        return `
            <div class="order-category${isOpen ? " open" : ""}" data-category="${cat.id}">
                <button class="category-toggle" type="button" aria-expanded="${isOpen}">
                    <span class="category-title">
                        <span class="category-emoji" aria-hidden="true">${cat.emoji}</span>
                        ${esc(cat.label)}
                        <small class="category-meta${availableCount === 0 ? " category-meta--none" : ""}">${availableCount === 0 ? "indisponible" : availableCount + " disponible" + (availableCount > 1 ? "s" : "")}</small>
                    </span>
                    <span class="category-arrow" aria-hidden="true">+</span>
                </button>
                <div class="product-order-list">${rows}</div>
            </div>`;
    }).join("");
}

// Pastilles des fiches "Notre sélection" (section produits)
function renderDetailChips() {

    document.querySelectorAll(".detail-products[data-category]").forEach((list) => {

        const products = catalogue.filter((p) => p.category === list.dataset.category);

        list.innerHTML = products.map((product) => {
            const cls = availabilityClass(product.availability);
            const note = product.availability === "disponible"
                ? ""
                : ` <span class="chip-note">${esc((AVAILABILITY_LABELS[product.availability] || "").toLowerCase())}</span>`;
            return `<li class="detail-chip detail-chip--${cls}"><span class="chip-dot dot-${cls}"></span>${esc(product.name)}${note}</li>`;
        }).join("");
    });
}

function applyCatalogue(products) {

    catalogue = products;

    // Nettoie la sélection : produit disparu ou devenu indisponible
    Object.keys(selection).forEach((id) => {
        const product = catalogue.find((p) => p.id === id);
        if (!product || product.availability === "indisponible") delete selection[id];
    });

    renderOrderList();
    renderDetailChips();
    updateOrder();
}



/* =========================================================
   ÉCRAN DE CHARGEMENT
========================================================= */

const loader = document.getElementById("loader");
const MIN_LOADER_TIME = 550; // ms — évite un flash trop rapide
const loaderStart = performance.now();

function hideLoader() {
    const elapsed = performance.now() - loaderStart;
    const remaining = Math.max(0, MIN_LOADER_TIME - elapsed);

    setTimeout(() => {
        loader.classList.add("loader-hidden");
        document.body.classList.add("hero-ready");

        // Retire complètement le loader du flux une fois l'animation de sortie finie
        setTimeout(() => {
            loader.style.display = "none";
        }, 700);
    }, remaining);
}

if (document.readyState === "complete") {
    hideLoader();
} else {
    window.addEventListener("load", hideLoader);
}


/* =========================================================
   RÉVÉLATIONS AU DÉFILEMENT
========================================================= */

const revealTargets = document.querySelectorAll(".reveal, .reveal-stagger");

if ("IntersectionObserver" in window) {

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("in-view");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    revealTargets.forEach((target) => revealObserver.observe(target));

} else {
    // Repli si IntersectionObserver n'est pas supporté : tout afficher directement
    revealTargets.forEach((target) => target.classList.add("in-view"));
}


/* =========================================================
   BARRE DE PROGRESSION + OMBRE DE LA NAVIGATION
========================================================= */

const scrollProgress = document.getElementById("scroll-progress");
const navBar = document.querySelector("nav");

function onScroll() {
    const scrollTop = window.scrollY;

    if (scrollProgress) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress.style.width = `${docHeight > 0 ? (scrollTop / docHeight) * 100 : 0}%`;
    }

    if (navBar) navBar.classList.toggle("nav-scrolled", scrollTop > 12);
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll();


/* =========================================================
   RETOUR EN HAUT DE PAGE
========================================================= */

const backToTopButton = document.getElementById("back-to-top");

if (backToTopButton) {
    backToTopButton.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}


/* =========================================================
   MENU MOBILE
========================================================= */

const menuToggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".menu");

function setMenuOpen(open) {
    menu.classList.toggle("menu-open", open);
    menuToggle.classList.toggle("active", open);
    menuToggle.setAttribute("aria-expanded", String(open));
}

menuToggle.setAttribute("aria-expanded", "false");

menuToggle.addEventListener("click", () => {
    setMenuOpen(!menu.classList.contains("menu-open"));
});

// Referme le menu après un clic sur un lien (mobile)
menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
});


/* =========================================================
   LIEN ACTIF DANS LE MENU (selon la section visible)
========================================================= */

if ("IntersectionObserver" in window) {

    const menuLinks = Array.from(menu.querySelectorAll("a"));
    const sectionToLink = new Map();

    menuLinks.forEach((link) => {
        const section = document.querySelector(link.getAttribute("href"));
        if (section) sectionToLink.set(section, link);
    });

    const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            menuLinks.forEach((l) => l.classList.remove("is-active"));
            sectionToLink.get(entry.target).classList.add("is-active");
        });
    }, { rootMargin: "-45% 0px -50% 0px" });

    sectionToLink.forEach((_, section) => spy.observe(section));
}


/* =========================================================
   COMMANDE RAPIDE (délégation d'événements : fonctionne même
   quand la liste est redessinée après un changement de catalogue)
========================================================= */

const summaryItems = document.querySelector(".summary-items");
const summaryCount = document.querySelector(".summary-count");
const summaryTotalWrapper = document.querySelector(".summary-total");
const summaryTotal = document.querySelector(".summary-total strong");
const summaryWeight = document.querySelector(".summary-weight");
const summaryPrice = document.getElementById("summary-price");

function pulseProduct(productEl) {
    productEl.classList.remove("order-product--updated");
    void productEl.offsetWidth; // redémarre l'animation
    productEl.classList.add("order-product--updated");
}

function readRow(productEl) {
    const id = productEl.dataset.productId;
    selection[id] = {
        format: productEl.querySelector("select").value,
        quantity: productEl.querySelector('input[type="number"]').value
    };
    pulseProduct(productEl);
    updateOrder();
}

if (orderCategoriesEl) {

    orderCategoriesEl.addEventListener("change", (event) => {
        const row = event.target.closest(".order-product");
        if (row && event.target.matches("select")) readRow(row);
    });

    orderCategoriesEl.addEventListener("input", (event) => {
        const row = event.target.closest(".order-product");
        if (row && event.target.matches('input[type="number"]')) readRow(row);
    });

    // Accordéon des catégories
    orderCategoriesEl.addEventListener("click", (event) => {
        const toggle = event.target.closest(".category-toggle");
        if (!toggle) return;

        const category = toggle.parentElement;
        const open = category.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));

        if (open) openCategories.add(category.dataset.category);
        else openCategories.delete(category.dataset.category);
    });
}


/* =========================================================
   LECTURE DE LA SÉLECTION (utilisée aussi pour WhatsApp et la base)
========================================================= */

function getSelectedProducts() {

    const selected = [];

    catalogue.forEach((product) => {

        const choice = selection[product.id];
        if (!choice || product.availability === "indisponible") return;

        const quantity = Number(choice.quantity);

        if (choice.format && quantity > 0) {
            selected.push({
                id: product.id,
                name: product.name,
                format: choice.format,
                quantity: Math.floor(quantity),
                availability: AVAILABILITY_LABELS[product.availability] || product.availability,
                price_per_kg: hasPrice(product) ? Number(product.price) : null
            });
        }
    });

    return selected;
}

function computeTotals(selected) {

    let bags = 0;
    let weight = 0;
    let estimated = 0;
    let allPriced = selected.length > 0;

    selected.forEach((item) => {
        const kgPerBag = parseFloat(item.format) || 0;
        bags += item.quantity;
        weight += kgPerBag * item.quantity;

        if (item.price_per_kg === null) allPriced = false;
        else estimated += item.price_per_kg * kgPerBag * item.quantity;
    });

    return { bags, weight, estimated: allPriced ? estimated : null };
}


/* =========================================================
   MISE À JOUR DU RÉCAPITULATIF
========================================================= */

function updateOrder() {

    if (!summaryItems) return;

    const selected = getSelectedProducts();
    const totals = computeTotals(selected);

    if (selected.length === 0) {
        summaryItems.innerHTML = `
            <p class="empty-order">
                Aucun produit sélectionné pour le moment.
            </p>
        `;
    } else {
        summaryItems.innerHTML = selected.map((item) => `
            <div class="summary-item" data-target-id="${esc(item.id)}">
                <div class="summary-item-main">
                    <strong>${esc(item.name)}</strong>
                    <span>${esc(item.format)} × ${item.quantity} sac(s)</span>
                </div>
                <button type="button" class="summary-item-remove" aria-label="Retirer ${esc(item.name)}">✕</button>
            </div>
        `).join("");
    }

    summaryCount.textContent = `${selected.length} produit${selected.length > 1 ? "s" : ""}`;
    summaryCount.classList.remove("bump");
    void summaryCount.offsetWidth;
    summaryCount.classList.add("bump");

    summaryTotal.textContent = totals.bags;
    summaryWeight.textContent = totals.weight > 0 ? `≈ ${totals.weight} kg au total` : "0 kg au total";

    if (summaryPrice) {
        if (selected.length === 0) {
            summaryPrice.textContent = "";
        } else if (totals.estimated !== null) {
            summaryPrice.textContent = `Estimation : ${formatDA(totals.estimated)}`;
        } else {
            summaryPrice.textContent = "Prix sur demande";
        }
    }

    summaryTotalWrapper.classList.remove("bump");
    void summaryTotalWrapper.offsetWidth;
    summaryTotalWrapper.classList.add("bump");
}


/* =========================================================
   SUPPRESSION D'UNE LIGNE / VIDER LA COMMANDE
========================================================= */

if (summaryItems) {
    summaryItems.addEventListener("click", (event) => {

        const removeButton = event.target.closest(".summary-item-remove");
        if (!removeButton) return;

        const id = removeButton.closest(".summary-item").dataset.targetId;
        delete selection[id];

        const row = document.querySelector(`.order-product[data-product-id="${CSS.escape(id)}"]`);
        if (row) {
            row.querySelector("select").value = "";
            row.querySelector('input[type="number"]').value = "";
            pulseProduct(row);
        }

        updateOrder();
    });
}

const clearOrderButton = document.querySelector(".clear-order");

if (clearOrderButton) {
    clearOrderButton.addEventListener("click", () => {
        Object.keys(selection).forEach((id) => delete selection[id]);
        renderOrderList();
        updateOrder();
    });
}


/* =========================================================
   TOAST DE CONFIRMATION
========================================================= */

const toast = document.getElementById("toast");
let toastTimeout;

function showToast(html, duration = 6000) {
    clearTimeout(toastTimeout);
    toast.innerHTML = html;
    toast.classList.add("toast-visible");

    toastTimeout = setTimeout(() => {
        toast.classList.remove("toast-visible");
    }, duration);
}


/* =========================================================
   ENVOI DE LA DEMANDE : WhatsApp (comme avant) + enregistrement
   dans la base pour le suivi dans /admin
========================================================= */

const contactForm = document.getElementById("contact-form");

if (contactForm) {

    contactForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const lastname = document.getElementById("lastname");
        const firstname = document.getElementById("firstname");
        const phone = document.getElementById("phone");
        const email = document.getElementById("email");
        const subject = document.getElementById("subject");
        const message = document.getElementById("message");
        const honeypot = document.getElementById("website");

        // Réinitialise les erreurs affichées précédemment
        contactForm.querySelectorAll(".form-group.field-error").forEach((el) => {
            el.classList.remove("field-error");
        });

        const requiredFields = [lastname, firstname, phone];
        let firstInvalid = null;

        requiredFields.forEach((el) => {
            if (!el.value.trim()) {
                el.closest(".form-group").classList.add("field-error");
                if (!firstInvalid) firstInvalid = el;
            }
        });

        if (firstInvalid) {
            showToast("Merci de renseigner au minimum votre nom, prénom et téléphone.");
            firstInvalid.focus();
            return;
        }

        const selectedProducts = getSelectedProducts();
        const totals = computeTotals(selectedProducts);

        // ----- Message WhatsApp -----
        const lines = [];

        lines.push("*Nouvelle demande — site BougieSec*");
        lines.push("");
        lines.push(`Nom : ${lastname.value.trim()}`);
        lines.push(`Prénom : ${firstname.value.trim()}`);
        lines.push(`Téléphone : ${phone.value.trim()}`);

        if (email.value.trim()) lines.push(`Email : ${email.value.trim()}`);
        if (subject.value) lines.push(`Sujet : ${subject.value}`);

        if (message.value.trim()) {
            lines.push("");
            lines.push("Message :");
            lines.push(message.value.trim());
        }

        if (selectedProducts.length > 0) {
            lines.push("");
            lines.push("Produits sélectionnés (commande rapide) :");

            selectedProducts.forEach((product) => {
                lines.push(
                    `- ${product.name} — ${product.format} × ${product.quantity} sac(s) (${product.availability})`
                );
            });

            lines.push("");
            lines.push(`Total : ${totals.bags} sac(s) ≈ ${totals.weight} kg`);
            if (totals.estimated !== null) {
                lines.push(`Estimation : ${formatDA(totals.estimated)}`);
            }
        }

        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;

        // Ouverture de WhatsApp d'abord (doit rester directement après le clic)
        const whatsappWindow = window.open(whatsappUrl, "_blank");

        if (!whatsappWindow) {
            showToast(
                `Votre demande est prête. <a href="${whatsappUrl}" target="_blank" rel="noopener">Cliquez ici pour l'envoyer sur WhatsApp</a>.`,
                10000
            );
        } else {
            showToast("Votre demande a été préparée et ouverte dans WhatsApp. Il ne vous reste plus qu'à l'envoyer !");
        }

        // ----- Enregistrement pour le suivi dans /admin (sans bloquer WhatsApp) -----
        // Le champ piège rempli = robot : on n'enregistre rien.
        if (!honeypot || !honeypot.value) {

            const order = {
                type: selectedProducts.length > 0 ? "commande" : "demande",
                lastname: lastname.value.trim().slice(0, 100),
                firstname: firstname.value.trim().slice(0, 100),
                phone: phone.value.trim().slice(0, 40),
                email: email.value.trim().slice(0, 150) || null,
                subject: subject.value || null,
                message: message.value.trim().slice(0, 4000) || null,
                items: selectedProducts,
                total_bags: totals.bags,
                total_weight: totals.weight,
                estimated_total: totals.estimated
            };

            DB.saveOrder(order).catch((err) => {
                console.error("Commande non enregistrée dans la base :", err);
            });
        }

        contactForm.reset();
        Object.keys(selection).forEach((id) => delete selection[id]);
        renderOrderList();
        updateOrder();
    });

}


/* =========================================================
   DÉMARRAGE : affichage du catalogue
   (placé en dernier : tout le reste du script doit déjà exister)
========================================================= */

// 1) affichage immédiat avec les valeurs locales / par défaut
applyCatalogue(getBougieSecProducts());

// 2) puis mise à jour avec la base de données partagée (si configurée)
if (DB.enabled) {
    loadBougieSecProducts().then(applyCatalogue);
}
