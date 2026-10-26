-- Limpa dados sensíveis de um dump de produção restaurado no banco LOCAL.
-- Objetivo: o app local fica com o mesmo "formato" e volume de dados da
-- produção, mas sem como mandar e-mail/push/cobrança de verdade pra ninguém
-- e sem as senhas reais. Usado por scripts/restore-dump.mjs.
--
-- Variáveis (psql -v):  pwd = hash bcrypt da senha de desenvolvimento
\set ON_ERROR_STOP on
BEGIN;

-- Usuários: só ADMIN mantém e-mail/telefone reais (é você); o resto vira
-- endereço fictício. Todos perdem o push token e ganham a senha de dev.
UPDATE users SET
  email = CASE WHEN role = 'ADMIN' THEN email
               ELSE 'user-' || id || '@example.com' END,
  phone = CASE WHEN role = 'ADMIN' THEN phone ELSE NULL END,
  "pushToken" = NULL,
  "passwordHash" = CASE WHEN "passwordHash" IS NULL THEN NULL ELSE :'pwd' END;

-- Convites e códigos de recuperação de senha pendentes não valem mais nada.
DELETE FROM account_invites;
DELETE FROM password_reset_tokens;

-- Cobranças: remove códigos Pix e ids do gateway (evita consultar/cobrar
-- transações reais a partir do ambiente local).
UPDATE payments SET "pixCopyPaste" = NULL, "pixQrCode" = NULL, "externalId" = NULL;
UPDATE payment_bundles SET "pixCopyPaste" = NULL, "pixQrCode" = NULL, "externalId" = NULL;

-- Chave Pix manual da escola.
UPDATE schools SET "pixKey" = NULL, "pixKeyType" = NULL;

COMMIT;
