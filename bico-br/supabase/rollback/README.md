# Reversão de migrations

Cada arquivo `.down.sql` desfaz a migration de mesmo número. Execute **na ordem inversa**.

**Antes de qualquer reversão em produção:** faça backup (`supabase db dump` ou PITR) —
reverter migrations de estrutura apaga as tabelas e os dados que elas contêm.
As reversões existem para homologação e para desfazer um deploy recém-aplicado, sem dados reais.
