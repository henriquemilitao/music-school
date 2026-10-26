-- OPCIONAL (flag --anon-names): troca nomes e textos livres por genéricos.
\set ON_ERROR_STOP on
BEGIN;
UPDATE users    SET name = 'Usuário ' || substr(id, 1, 6) WHERE role <> 'ADMIN';
UPDATE students SET name = 'Aluno '   || substr(id, 1, 6), notes = NULL;
UPDATE lessons  SET notes = NULL, "cancelReason" = NULL;
COMMIT;
