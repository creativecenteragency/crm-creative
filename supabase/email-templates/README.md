# Plantillas de Auth (Supabase)

Estas dos plantillas no las lee ningún archivo del proyecto — Supabase Auth las
sirve desde su propio editor (Dashboard → Authentication → Email Templates),
no hay CLI ni migración para esto. Las versionamos aquí solo para tener un
registro de qué está cargado ahí y poder revisarlo en un diff en vez de perder
el rastro en el dashboard.

Para aplicar un cambio: Dashboard → Authentication → Email Templates → elegir
la plantilla → pegar el Subject y el Body de acá.

- `invite.html` → plantilla **Invite user**. Subject sugerido: `Te invitaron a CRM Creative`
- `reset-password.html` → plantilla **Reset Password**. Subject sugerido: `Restablecé tu contraseña — CRM Creative`

Variables de Supabase usadas: `{{ .ConfirmationURL }}` (el link de acción,
Supabase lo arma solo con el token correcto para cada tipo de mail).

Esto requiere que el SMTP custom de Supabase (Resend) siga configurado en
Project Settings → Auth → SMTP Settings — si no, Supabase manda estos mismos
templates pero desde su servidor genérico, que es justamente lo que hace que
caigan en spam.
