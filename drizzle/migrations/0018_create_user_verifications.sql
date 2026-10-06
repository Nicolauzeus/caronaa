-- ============================================================
-- CARONAA
-- Migration 0018
--
-- Verificações de vínculo/confiança do usuário.
--
-- Tipos iniciais:
--   - UNIFOR
--   - STS_2026
--
-- Um mesmo usuário pode possuir múltiplas verificações.
--
-- Regras:
--
-- UNIFOR
--   E-mail confirmado do Supabase terminando exatamente em:
--     @unifor.br
--     @edu.unifor.br
--
-- STS_2026
--   E-mail confirmado do Supabase correspondente a uma resposta
--   válida do formulário cuja origem seja sts-2026.
--
-- O browser NÃO recebe permissão para inserir, editar ou apagar
-- verificações diretamente.
-- ============================================================


-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE public.user_verification_type AS ENUM (
  'UNIFOR',
  'STS_2026'
);

CREATE TYPE public.user_verification_status AS ENUM (
  'VERIFIED',
  'REVOKED'
);

CREATE TYPE public.user_verification_source AS ENUM (
  'EMAIL_DOMAIN',
  'EVENT_FORM',
  'ADMIN'
);


-- ============================================================
-- 2. TABELA
-- ============================================================

CREATE TABLE public.user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL,

  type public.user_verification_type NOT NULL,

  status public.user_verification_status
    NOT NULL
    DEFAULT 'VERIFIED',

  source public.user_verification_source NOT NULL,

  institution_name text,

  verified_email text,

  source_reference_id text,

  verified_at timestamptz,

  created_at timestamptz
    NOT NULL
    DEFAULT now(),

  updated_at timestamptz
    NOT NULL
    DEFAULT now(),

  CONSTRAINT user_verifications_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT user_verifications_user_type_unique
    UNIQUE (user_id, type),

  CONSTRAINT user_verifications_verified_at_check
    CHECK (
      status <> 'VERIFIED'
      OR verified_at IS NOT NULL
    )
);


-- ============================================================
-- 3. ÍNDICES
-- ============================================================

CREATE INDEX user_verifications_user_id_idx
ON public.user_verifications (user_id);

CREATE INDEX user_verifications_type_idx
ON public.user_verifications (type);

CREATE INDEX user_verifications_status_idx
ON public.user_verifications (status);

CREATE INDEX user_verifications_verified_email_idx
ON public.user_verifications (lower(verified_email))
WHERE verified_email IS NOT NULL;

CREATE INDEX user_verifications_source_reference_idx
ON public.user_verifications (source_reference_id)
WHERE source_reference_id IS NOT NULL;


-- Índice necessário para localizar rapidamente uma submissão STS
-- pelo e-mail sem depender de maiúsculas/minúsculas.
CREATE INDEX IF NOT EXISTS form_submissions_normalized_email_idx
ON public.form_submissions (lower(btrim(email)))
WHERE email IS NOT NULL;


-- ============================================================
-- 4. PERMISSÕES DA TABELA
-- ============================================================

REVOKE ALL
ON public.user_verifications
FROM PUBLIC;

REVOKE ALL
ON public.user_verifications
FROM anon;

REVOKE ALL
ON public.user_verifications
FROM authenticated;


-- Usuário autenticado poderá somente consultar.
GRANT SELECT
ON public.user_verifications
TO authenticated;


-- Operações privilegiadas continuam disponíveis ao service role.
GRANT ALL
ON public.user_verifications
TO service_role;


-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.user_verifications
ENABLE ROW LEVEL SECURITY;


-- Usuário consulta suas próprias verificações.
CREATE POLICY "Users can read their own verifications"
ON public.user_verifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);


-- Admin consulta todas as verificações.
CREATE POLICY "Admins can read all user verifications"
ON public.user_verifications
FOR SELECT
TO authenticated
USING (
  public.has_role(
    auth.uid(),
    'admin'::public.app_role
  )
);


-- ============================================================
-- 6. UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_user_verification_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


REVOKE ALL
ON FUNCTION public.set_user_verification_updated_at()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.set_user_verification_updated_at()
FROM anon;

REVOKE ALL
ON FUNCTION public.set_user_verification_updated_at()
FROM authenticated;


CREATE TRIGGER set_user_verifications_updated_at
BEFORE UPDATE
ON public.user_verifications
FOR EACH ROW
EXECUTE FUNCTION public.set_user_verification_updated_at();


-- ============================================================
-- 7. FUNÇÃO CENTRAL DE SINCRONIZAÇÃO
--
-- Essa função é a única responsável por determinar as
-- verificações automáticas do usuário.
--
-- O frontend NÃO escolhe verification_type.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_user_verifications(
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_email_confirmed_at timestamptz;
  v_normalized_email text;
  v_email_domain text;

  v_sts_submission_id uuid;
BEGIN

  -- ----------------------------------------------------------
  -- Busca a conta real no Supabase Auth.
  -- ----------------------------------------------------------

  SELECT
    u.email,
    u.email_confirmed_at
  INTO
    v_email,
    v_email_confirmed_at
  FROM auth.users u
  WHERE u.id = _user_id;


  -- Usuário inexistente.
  IF NOT FOUND THEN
    RETURN;
  END IF;


  -- ----------------------------------------------------------
  -- Somente e-mail confirmado pode gerar verificação.
  -- ----------------------------------------------------------

  IF v_email IS NULL
     OR v_email_confirmed_at IS NULL
  THEN
    RETURN;
  END IF;


  v_normalized_email := lower(btrim(v_email));


  -- Obtém somente o domínio depois do @.
  --
  -- Exemplo:
  -- aluno@edu.unifor.br
  -- -> edu.unifor.br
  --
  -- Isso impede:
  --
  -- aluno@edu.unifor.br.fake.com
  -- aluno@fakeunifor.br
  -- ----------------------------------------------------------

  v_email_domain :=
    lower(
      regexp_replace(
        v_normalized_email,
        '^.*@',
        ''
      )
    );


  -- ==========================================================
  -- UNIFOR
  -- ==========================================================

  IF v_email_domain IN (
    'unifor.br',
    'edu.unifor.br'
  )
  THEN

    INSERT INTO public.user_verifications (
      user_id,
      type,
      status,
      source,
      institution_name,
      verified_email,
      source_reference_id,
      verified_at
    )
    VALUES (
      _user_id,
      'UNIFOR',
      'VERIFIED',
      'EMAIL_DOMAIN',
      'Universidade de Fortaleza',
      v_normalized_email,
      NULL,
      now()
    )

    ON CONFLICT (user_id, type)
    DO UPDATE SET
      status = 'VERIFIED',
      source = 'EMAIL_DOMAIN',
      institution_name = 'Universidade de Fortaleza',
      verified_email = EXCLUDED.verified_email,
      source_reference_id = NULL,

      verified_at = CASE
        WHEN public.user_verifications.status = 'VERIFIED'
          THEN public.user_verifications.verified_at
        ELSE now()
      END,

      updated_at = now();


  ELSE

    -- Caso o usuário possuísse selo UNIFOR e depois altere
    -- o e-mail confirmado para um domínio não institucional,
    -- o vínculo é revogado.
    UPDATE public.user_verifications
    SET
      status = 'REVOKED',
      updated_at = now()
    WHERE user_id = _user_id
      AND type = 'UNIFOR'
      AND status = 'VERIFIED';

  END IF;


  -- ==========================================================
  -- STS 2026
  --
  -- Procura submissão do formulário oficial do evento pelo
  -- mesmo e-mail confirmado.
  --
  -- O source "sts-2026" já é utilizado atualmente pelo
  -- formulário CARONAA.
  -- ==========================================================

  SELECT fs.submission_id
  INTO v_sts_submission_id
  FROM public.form_submissions fs
  WHERE fs.email IS NOT NULL

    AND lower(btrim(fs.email))
        = v_normalized_email

    AND lower(btrim(fs.source))
        = 'sts-2026'

  ORDER BY fs.created_at ASC
  LIMIT 1;


  IF v_sts_submission_id IS NOT NULL
  THEN

    INSERT INTO public.user_verifications (
      user_id,
      type,
      status,
      source,
      institution_name,
      verified_email,
      source_reference_id,
      verified_at
    )
    VALUES (
      _user_id,
      'STS_2026',
      'VERIFIED',
      'EVENT_FORM',
      'Siará Tech Summit 2026',
      v_normalized_email,
      v_sts_submission_id::text,
      now()
    )

    ON CONFLICT (user_id, type)
    DO UPDATE SET
      status = 'VERIFIED',
      source = 'EVENT_FORM',
      institution_name = 'Siará Tech Summit 2026',
      verified_email = EXCLUDED.verified_email,
      source_reference_id = EXCLUDED.source_reference_id,

      verified_at = CASE
        WHEN public.user_verifications.status = 'VERIFIED'
          THEN public.user_verifications.verified_at
        ELSE now()
      END,

      updated_at = now();


  ELSE

    -- Se o e-mail confirmado atual não possui uma submissão
    -- STS correspondente, revogamos uma credencial automática
    -- anteriormente ligada a outro e-mail.
    UPDATE public.user_verifications
    SET
      status = 'REVOKED',
      updated_at = now()
    WHERE user_id = _user_id
      AND type = 'STS_2026'
      AND source = 'EVENT_FORM'
      AND status = 'VERIFIED';

  END IF;

END;
$$;


-- A função central NÃO pode ser chamada diretamente pelo browser.
REVOKE ALL
ON FUNCTION public.sync_user_verifications(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.sync_user_verifications(uuid)
FROM anon;

REVOKE ALL
ON FUNCTION public.sync_user_verifications(uuid)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.sync_user_verifications(uuid)
TO service_role;

GRANT EXECUTE
ON FUNCTION public.sync_user_verifications(uuid)
TO supabase_auth_admin;


-- ============================================================
-- 8. HANDLE_NEW_USER
--
-- Mantém exatamente o comportamento atual:
--
-- - cria profile;
-- - primeiro usuário recebe admin;
-- - próximos recebem user;
--
-- E adiciona:
--
-- - sincronização das verificações.
--
-- Isso também cobre OAuth/Google quando o provider já cria a
-- conta com e-mail confirmado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
BEGIN

  PERFORM pg_advisory_xact_lock(
    hashtext('caronaa:first-admin')
  );


  -- ----------------------------------------------------------
  -- Profile
  -- ----------------------------------------------------------

  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url
  )
  VALUES (
    NEW.id,

    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      ''
    ),

    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    )
  )

  ON CONFLICT (id)
  DO UPDATE SET

    full_name = CASE
      WHEN public.profiles.full_name = ''
        THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,

    avatar_url = COALESCE(
      public.profiles.avatar_url,
      EXCLUDED.avatar_url
    ),

    updated_at = now();


  -- ----------------------------------------------------------
  -- Role
  -- ----------------------------------------------------------

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
  THEN
    assigned_role := 'user';
  ELSE
    assigned_role := 'admin';
  END IF;


  INSERT INTO public.user_roles (
    user_id,
    role
  )
  VALUES (
    NEW.id,
    assigned_role
  )
  ON CONFLICT (user_id, role)
  DO NOTHING;


  -- ----------------------------------------------------------
  -- Verificações
  --
  -- Se o e-mail ainda não estiver confirmado, a função apenas
  -- retorna. A confirmação posterior será capturada por outro
  -- trigger criado abaixo.
  -- ----------------------------------------------------------

  PERFORM public.sync_user_verifications(
    NEW.id
  );


  RETURN NEW;

END;
$$;


REVOKE ALL
ON FUNCTION public.handle_new_user()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.handle_new_user()
FROM anon;

REVOKE ALL
ON FUNCTION public.handle_new_user()
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO service_role;

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO supabase_auth_admin;


-- ============================================================
-- 9. CONFIRMAÇÃO / TROCA DE E-MAIL
--
-- Cadastro com senha normalmente cria auth.users antes de o
-- usuário confirmar seu endereço.
--
-- Portanto precisamos sincronizar novamente quando:
--
-- - email muda;
-- - email_confirmed_at muda.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF NEW.email IS DISTINCT FROM OLD.email
     OR NEW.email_confirmed_at
        IS DISTINCT FROM OLD.email_confirmed_at
  THEN

    PERFORM public.sync_user_verifications(
      NEW.id
    );

  END IF;


  RETURN NEW;

END;
$$;


REVOKE ALL
ON FUNCTION public.handle_auth_user_verification_change()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.handle_auth_user_verification_change()
FROM anon;

REVOKE ALL
ON FUNCTION public.handle_auth_user_verification_change()
FROM authenticated;


DROP TRIGGER IF EXISTS
on_auth_user_verification_change
ON auth.users;


CREATE TRIGGER on_auth_user_verification_change
AFTER UPDATE OF email, email_confirmed_at
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_verification_change();


-- ============================================================
-- 10. NOVA SUBMISSÃO DO FORMULÁRIO STS
--
-- Resolve:
--
-- usuário já possui conta
--       ↓
-- preenche formulário STS
--       ↓
-- recebe selo automaticamente
--
-- Não precisamos fazer isso no React.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_sts_form_submission_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_normalized_email text;
BEGIN

  -- Somente submissões do STS interessam aqui.
  IF lower(btrim(NEW.source)) <> 'sts-2026'
  THEN
    RETURN NEW;
  END IF;


  IF NEW.email IS NULL
     OR btrim(NEW.email) = ''
  THEN
    RETURN NEW;
  END IF;


  v_normalized_email :=
    lower(btrim(NEW.email));


  -- Pode haver no máximo uma conta normal por e-mail no fluxo
  -- comum do Supabase, mas usamos loop para evitar depender dessa
  -- suposição internamente.
  FOR v_user IN

    SELECT
      u.id

    FROM auth.users u

    WHERE u.email IS NOT NULL

      AND u.email_confirmed_at IS NOT NULL

      AND lower(btrim(u.email))
          = v_normalized_email

  LOOP

    PERFORM public.sync_user_verifications(
      v_user.id
    );

  END LOOP;


  RETURN NEW;

END;
$$;


REVOKE ALL
ON FUNCTION public.handle_sts_form_submission_verification()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.handle_sts_form_submission_verification()
FROM anon;

REVOKE ALL
ON FUNCTION public.handle_sts_form_submission_verification()
FROM authenticated;


DROP TRIGGER IF EXISTS
on_sts_form_submission_created
ON public.form_submissions;


CREATE TRIGGER on_sts_form_submission_created
AFTER INSERT
ON public.form_submissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_sts_form_submission_verification();


-- ============================================================
-- 11. BACKFILL
--
-- Sincroniza contas já existentes.
--
-- Isso é importante porque estamos adicionando a funcionalidade
-- em um projeto que já possui usuários.
-- ============================================================

DO $$
DECLARE
  v_user record;
BEGIN

  FOR v_user IN

    SELECT u.id
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL

  LOOP

    PERFORM public.sync_user_verifications(
      v_user.id
    );

  END LOOP;

END;
$$;


-- ============================================================
-- 12. COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE public.user_verifications IS
'Credenciais verificadas de vínculo e participação dos usuários do CARONAA.';


COMMENT ON COLUMN public.user_verifications.type IS
'Tipo da verificação: UNIFOR ou STS_2026.';


COMMENT ON COLUMN public.user_verifications.status IS
'VERIFIED representa credencial ativa; REVOKED representa credencial revogada.';


COMMENT ON COLUMN public.user_verifications.source IS
'Origem da verificação: domínio de e-mail, formulário de evento ou ação administrativa.';


COMMENT ON COLUMN public.user_verifications.institution_name IS
'Nome legível da instituição ou evento relacionado à credencial.';


COMMENT ON COLUMN public.user_verifications.verified_email IS
'E-mail confirmado e normalizado utilizado para estabelecer o vínculo.';


COMMENT ON COLUMN public.user_verifications.source_reference_id IS
'Referência que originou a verificação, como submission_id do formulário STS.';


COMMENT ON COLUMN public.user_verifications.verified_at IS
'Momento em que a credencial atual foi concedida.';


-- ============================================================
-- ADMIN: leitura sanitizada de usuários
-- ============================================================
--
-- Esta função é a única ponte administrativa entre:
--   auth.users
--   public.profiles
--   public.user_roles
--   public.user_verifications
--
-- Ela NÃO expõe auth.users diretamente ao browser.
-- Somente usuários com role admin podem executá-la.
--
-- p_user_id:
--   NULL  -> retorna todos os usuários
--   UUID  -> retorna somente o usuário solicitado
--

CREATE OR REPLACE FUNCTION public.get_admin_users(
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'fullName', COALESCE(NULLIF(BTRIM(p.full_name), ''), ''),
        'email', COALESCE(u.email, ''),
        'emailConfirmed', u.email_confirmed_at IS NOT NULL,
        'avatarUrl', p.avatar_url,
        'city', p.city,
        'createdAt', u.created_at,
        'lastSignInAt', u.last_sign_in_at,

        'roles',
        COALESCE(
          (
            SELECT jsonb_agg(
              ur.role::text
              ORDER BY
                CASE ur.role
                  WHEN 'admin' THEN 1
                  WHEN 'moderator' THEN 2
                  ELSE 3
                END
            )
            FROM public.user_roles ur
            WHERE ur.user_id = u.id
          ),
          '[]'::jsonb
        ),

        'verifications',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', uv.id,
                'type', uv.type::text,
                'status', uv.status::text,
                'source', uv.source::text,
                'institutionName', uv.institution_name,
                'verifiedEmail', uv.verified_email,
                'sourceReferenceId', uv.source_reference_id,
                'verifiedAt', uv.verified_at
              )
              ORDER BY uv.type::text
            )
            FROM public.user_verifications uv
            WHERE uv.user_id = u.id
              AND uv.status = 'VERIFIED'
          ),
          '[]'::jsonb
        )
      )
      ORDER BY u.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN public.profiles p
    ON p.id = u.id
  WHERE p_user_id IS NULL
     OR u.id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL
ON FUNCTION public.get_admin_users(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.get_admin_users(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.get_admin_users(uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.get_admin_users(uuid)
TO service_role;