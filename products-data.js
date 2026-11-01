/* =========================================================
   CATALOGUE PRODUITS — BougieSec
   ---------------------------------------------------------
   Ce fichier contient les produits PAR DÉFAUT (nom, catégorie,
   prix, disponibilité). Le site et /admin lisent d'abord la
   base de données (si config.js est rempli), puis, à défaut,
   ces valeurs.

   Pour changer un prix ou une disponibilité au quotidien,
   utilisez /admin : inutile de modifier ce fichier.

   price : prix en DA par kg, ou null tant qu'il n'est pas défini
           (le site affiche alors "Prix sur demande").
========================================================= */

const BOUGIESEC_STORAGE_KEY = "bougiesec_products_v2";

/* Catégories : l'ordre ici est l'ordre d'affichage sur le site. */
const CATEGORIES = [
    { id: "noix",    label: "Noix & fruits à coque",  emoji: "🥜" },
    { id: "legumes", label: "Légumes secs",           emoji: "🫘" },
    { id: "riz",     label: "Riz",                    emoji: "🍚" },
    { id: "farines", label: "Farines & autres produits", emoji: "🌾" }
];

const DEFAULT_PRODUCTS = [
    // Noix & fruits à coque — indisponibles pour le moment
    { id: "noix",       category: "noix", name: "Noix",          price: null, availability: "indisponible" },
    { id: "amandes",    category: "noix", name: "Amandes",       price: null, availability: "indisponible" },
    { id: "cajou",      category: "noix", name: "Noix de cajou", price: null, availability: "indisponible" },
    { id: "pistaches",  category: "noix", name: "Pistaches",     price: null, availability: "indisponible" },
    { id: "cacahuetes", category: "noix", name: "Cacahuètes",    price: null, availability: "indisponible" },

    // Légumes secs
    { id: "haricots-blancs",    category: "legumes", name: "Haricot blanc",                price: null, availability: "disponible" },
    { id: "haricots-rouges",    category: "legumes", name: "Haricots rouges LSB",          price: null, availability: "disponible" },
    { id: "lentilles-corail",   category: "legumes", name: "Lentilles rouges décortiquées", price: null, availability: "disponible" },
    { id: "lentilles-brunes",   category: "legumes", name: "Lentilles royales",            price: null, availability: "disponible" },
    { id: "pois-chiches",       category: "legumes", name: "Pois chiches",                 price: null, availability: "disponible" },
    { id: "haricots-oeil-noir", category: "legumes", name: "Haricots à œil noir",          price: null, availability: "indisponible" },
    { id: "feves-seches",       category: "legumes", name: "Fèves sèches",                 price: null, availability: "indisponible" },

    // Riz
    { id: "riz-basmati-etuve", category: "riz", name: "Riz basmati étuvé", price: null, availability: "disponible" },
    { id: "riz-etuve",         category: "riz", name: "Riz étuvé",         price: null, availability: "disponible" },

    // Farines & autres produits secs — indisponibles pour le moment
    { id: "farine-pois-chiche", category: "farines", name: "Farine de pois chiche", price: null, availability: "indisponible" },
    { id: "maizena",            category: "farines", name: "Maïzena",               price: null, availability: "indisponible" },
    { id: "sucre-glace",        category: "farines", name: "Sucre glace",           price: null, availability: "indisponible" }
];

const AVAILABILITY_LABELS = {
    disponible: "Disponible",
    limite: "Stock limité",
    indisponible: "Indisponible"
};

/* Version synchrone (utilisée au premier affichage) : valeurs par défaut,
   complétées par une éventuelle sauvegarde locale de ce navigateur. */
function getBougieSecProducts() {
    try {
        const raw = localStorage.getItem(BOUGIESEC_STORAGE_KEY);
        if (!raw) return DEFAULT_PRODUCTS.map((p) => ({ ...p }));

        const saved = JSON.parse(raw);
        if (!Array.isArray(saved) || saved.length === 0) {
            return DEFAULT_PRODUCTS.map((p) => ({ ...p }));
        }
        return saved;
    } catch (err) {
        console.error("Impossible de lire le catalogue enregistré :", err);
        return DEFAULT_PRODUCTS.map((p) => ({ ...p }));
    }
}

/* Version complète : base de données d'abord, puis repli sur le local / défaut. */
async function loadBougieSecProducts() {
    if (typeof DB !== "undefined" && DB.enabled) {
        try {
            const rows = await DB.listProducts();
            if (rows && rows.length) return rows;
        } catch (err) {
            console.error("Catalogue en ligne indisponible, valeurs par défaut utilisées :", err);
        }
    }
    return getBougieSecProducts();
}
