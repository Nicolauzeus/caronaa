import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, CheckCircle2, X, Loader2, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  searchLocationsServerFn,
  getLocationDetailsServerFn,
} from "@/lib/location.functions";
import type { FormLocationDetails, LocationSuggestion } from "@/lib/location/types";

interface LocationAutocompleteProps {
  id: string;
  label: string;
  value?: string;
  selectedLocation?: FormLocationDetails;
  placeholder?: string;
  onChange: (value: string, details?: FormLocationDetails) => void;
  helperText?: string;
  shortcutButton?: React.ReactNode;
  required?: boolean;
}

export function LocationAutocomplete({
  id,
  label,
  value = "",
  selectedLocation,
  placeholder = "Digite o bairro, universidade, rua ou local...",
  onChange,
  helperText,
  shortcutButton,
  required = false,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchServerFn = useServerFn(searchLocationsServerFn);
  const detailsServerFn = useServerFn(getLocationDetailsServerFn);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestIdRef = useRef<number>(0);

  // Sincroniza query local com valor externo se alterado
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const executeSearch = useCallback(
    async (searchText: string) => {
      const requestId = ++latestRequestIdRef.current;
      const trimmed = searchText.trim();

      if (trimmed.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await searchServerFn({ data: { query: trimmed } });

        // Descarta respostas fora de ordem
        if (requestId !== latestRequestIdRef.current) return;

        setIsConfigured(response.isConfigured);

        if (!response.isConfigured) {
          // Provedor não configurado no servidor: opera em fallback manual
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        if (response.error) {
          setErrorMessage(response.error);
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        setSuggestions(response.suggestions || []);
        setIsOpen((response.suggestions || []).length > 0);
      } catch (err) {
        if (requestId !== latestRequestIdRef.current) return;
        // Falha de rede ou servidor: ativa fallback gracioso
        setSuggestions([]);
        setIsOpen(false);
        setErrorMessage(err instanceof Error ? err.message : "Busca indisponível");
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [searchServerFn],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setQuery(nextVal);

    // Propaga alteração imediata como entrada manual
    onChange(nextVal, {
      rawText: nextVal,
      formattedAddress: nextVal,
      neighborhood: nextVal,
    });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(nextVal);
    }, 300);
  };

  const handleSelectSuggestion = async (sug: LocationSuggestion) => {
    setIsOpen(false);
    setIsLoading(true);

    try {
      // Tenta obter detalhes com coordenadas e componentes exatos
      let details: LocationSuggestion = sug;
      if (sug.providerId) {
        const detailsResp = await detailsServerFn({ data: { placeId: sug.providerId } });
        if (detailsResp?.details) {
          details = detailsResp.details;
        }
      }

      const displayAddress = details.neighborhood || details.mainText || details.formattedAddress;
      setQuery(displayAddress);

      const locationDetails: FormLocationDetails = {
        rawText: query,
        formattedAddress: details.formattedAddress,
        city: details.city,
        state: details.state,
        neighborhood: details.neighborhood,
        lat: details.lat,
        lng: details.lng,
        providerId: details.providerId,
      };

      onChange(displayAddress, locationDetails);
    } catch {
      // Fallback usando a sugestão básica já recebida
      const displayAddress = sug.neighborhood || sug.mainText || sug.formattedAddress;
      setQuery(displayAddress);
      onChange(displayAddress, {
        rawText: query,
        formattedAddress: sug.formattedAddress,
        city: sug.city,
        state: sug.state,
        neighborhood: sug.neighborhood,
        providerId: sug.providerId,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange("", undefined);
    setSuggestions([]);
    setIsOpen(false);
  };

  // Se o provedor não está configurado no servidor ou se houve erro
  const isFallbackMode = isConfigured === false || Boolean(errorMessage);

  return (
    <div className="relative space-y-1.5" ref={wrapperRef}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label} {required ? "*" : ""}
        </label>
        {shortcutButton}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-caronaa-primary-strong" />
          ) : (
            <MapPin size={17} />
          )}
        </div>

        <input
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-border bg-background pl-10 pr-10 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
        />

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition"
            aria-label="Limpar localização"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* Aviso discreto de modo fallback se não houver chave configurada */}
      {isFallbackMode && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
          <Info size={12} className="shrink-0" />
          <span>Preenchimento manual ativo (digite o bairro, cidade ou ponto de referência)</span>
        </p>
      )}

      {helperText && !isFallbackMode ? (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      ) : null}

      {/* Dropdown de sugestões do autocomplete */}
      {isOpen && suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Sugestões de localização"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
            Sugestões encontradas
          </div>
          {suggestions.map((sug, idx) => (
            <button
              key={sug.providerId || idx}
              type="button"
              role="option"
              onClick={() => void handleSelectSuggestion(sug)}
              className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left text-sm transition hover:bg-caronaa-primary/10 hover:text-caronaa-dark dark:hover:text-caronaa-primary focus:bg-caronaa-primary/10 focus:outline-none"
            >
              <Search size={15} className="mt-0.5 shrink-0 text-caronaa-primary-strong" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">
                  {sug.mainText}
                </div>
                {sug.secondaryText ? (
                  <div className="text-xs text-muted-foreground truncate">
                    {sug.secondaryText}
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Feedback visual com dados estruturados selecionados */}
      {selectedLocation && selectedLocation.neighborhood && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <span className="flex items-center gap-1.5 font-medium truncate">
            <CheckCircle2 size={13} className="shrink-0" />
            <span className="truncate">
              📍 {selectedLocation.neighborhood}
              {selectedLocation.city ? `, ${selectedLocation.city}` : ""}
            </span>
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
            Local selecionado
          </span>
        </div>
      )}
    </div>
  );
}
