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
    SUPABASE_URL: "https://pueaxemqnprpgwcauynl.supabase.co/rest/v1/",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZWF4ZW1xbnBycGd3Y2F1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzE1MTYsImV4cCI6MjEwNjgwNzUxNn0.yicTeL7bXnxVl9_KqXZnlyVvs8IT-NgMl3fBEJTJTXc",
    ADMIN_EMAIL: "xboxaimed@gmail.com"
};
