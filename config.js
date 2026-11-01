/* =========================================================
   CONFIGURATION — BougieSec
   ---------------------------------------------------------
   Pour activer la base de données partagée (commandes visibles
   dans /admin depuis n'importe quel appareil), renseignez les
   3 valeurs ci-dessous. Tant qu'elles sont vides, le site
   fonctionne en "mode local" (test dans un seul navigateur).

   - SUPABASE_URL      : Supabase > Project Settings > API > Project URL
   - SUPABASE_ANON_KEY : Supabase > Project Settings > API > clé "anon" / "publishable"
                         (cette clé est faite pour être publique : ce n'est PAS la clé "service_role")
   - ADMIN_EMAIL       : l'email du compte administrateur créé dans Supabase > Authentication > Users
========================================================= */
window.BOUGIESEC_CONFIG = {
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    ADMIN_EMAIL: ""
};
