-- Migration: 0021_create_pitch_relationships.sql
-- Create table for capturing Pitch QR code relationship contacts and suggestions

CREATE TABLE IF NOT EXISTS public.pitch_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    interest TEXT NOT NULL CHECK (interest IN ('INVESTIDOR', 'PARCEIRO', 'AMBOS')),
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    phone TEXT,
    same_phone_whatsapp BOOLEAN NOT NULL DEFAULT true,
    email TEXT,
    investor_update_preference TEXT CHECK (investor_update_preference IN ('DURANTE_VALIDACAO', 'AVISO_TERMINO', 'PRINCIPAIS_RESULTADOS', 'CONVERSAR_DIRETO')),
    institution_name TEXT,
    institution_type TEXT CHECK (institution_type IN ('UNIVERSIDADE', 'EMPRESA', 'INSTITUICAO', 'COMUNIDADE', 'OUTRO')),
    institution_address TEXT,
    partnership_type TEXT CHECK (partnership_type IN ('TESTAR_INSTITUICAO', 'APRESENTAR_SOLUCAO', 'PILOTO', 'OUTRO')),
    partnership_type_custom TEXT,
    message TEXT NOT NULL,
    consent_contact BOOLEAN NOT NULL DEFAULT false,
    consent_newsletter BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO', 'CONTACTADO', 'EM_ACOMPANHAMENTO', 'CONVERTIDO', 'ARQUIVADO')),
    suggestion_status TEXT NOT NULL DEFAULT 'NOVA' CHECK (suggestion_status IN ('NOVA', 'EM_ANALISE', 'RESPONDIDA', 'ARQUIVADA')),
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'pitch_sts_2026',
    raw_payload JSONB
);

-- Enable RLS
ALTER TABLE public.pitch_contacts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to submit contacts
CREATE POLICY "Allow public insert to pitch_contacts"
    ON public.pitch_contacts
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow authenticated admins to view and manage pitch contacts
CREATE POLICY "Allow authenticated read pitch_contacts"
    ON public.pitch_contacts
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated update pitch_contacts"
    ON public.pitch_contacts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_pitch_contacts_created_at ON public.pitch_contacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitch_contacts_interest ON public.pitch_contacts (interest);
CREATE INDEX IF NOT EXISTS idx_pitch_contacts_status ON public.pitch_contacts (status);
CREATE INDEX IF NOT EXISTS idx_pitch_contacts_suggestion_status ON public.pitch_contacts (suggestion_status);
