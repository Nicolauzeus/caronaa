import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, CheckCircle2, X, Loader2, Edit2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchLocationsServerFn, getLocationDetailsServerFn } from "@/lib/location.functions";
import { searchCatalogLocations } from "@/lib/location/ceara-catalog";
import type { FormLocationDetails, LocationSuggestion } from "@/lib/location/types";

export interface LocationAutocompleteProps {
  id: string;
  label?: string;
  value?: string;
  selectedLocation?: FormLocationDetails | undefined;
  placeholder?: string;
  onChange: (value: string, details?: FormLocationDetails) => void;
  /** Fires only when a suggested location was confirmed by a tap. */
  onSelect?: (value: string, details: FormLocationDetails) => void;
  helperText?: string;
  shortcutButton?: React.ReactNode;
  required?: boolean;
  variant?: "card" | "simple" | "glass";
  autoFocus?: boolean;
}

function formatSelectedTitle(loc: FormLocationDetails): string {
  const city = loc.city || "Fortaleza";
  const state = loc.state || "CE";

  const rawLower = (loc.rawText || "").toLowerCase();
  const addrLower = (loc.formattedAddress || "").toLowerCase();

  if (
    rawLower.includes("unifor") ||
    addrLower.includes("universidade de fortaleza") ||
    addrLower.includes("unifor")
  ) {
    return `Universidade de Fortaleza — ${city}, ${state}`;
  }

  if (rawLower.includes("centro de eventos") || addrLower.includes("centro de eventos")) {
    return `Centro de Eventos do Ceará — ${city}, ${state}`;
  }

  if (loc.formattedAddress) {
    const firstPart = loc.formattedAddress.split(",")[0].trim();
    if (
      firstPart &&
      !firstPart.match(/^(rua|av|avenida|travessa|rodovia)\s/i) &&
      firstPart.length > 2
    ) {
      return `${firstPart} — ${city}, ${state}`;
    }
  }

  if (loc.neighborhood) {
    return `${loc.neighborhood} — ${city}, ${state}`;
  }

  if (loc.city && loc.city !== "Fortaleza") {
    return `${loc.city}, ${state}`;
  }

  return loc.formattedAddress || loc.rawText || `${city}, ${state}`;
}

// Cache em memória no cliente para respostas em 0ms
const CLIENT_LOCATION_CACHE = new Map<string, LocationSuggestion[]>();

export function LocationAutocomplete({
  id,
  label,
  value = "",
  selectedLocation,
  placeholder = "Digite o bairro, universidade, rua ou local...",
  onChange,
  onSelect,
  helperText,
  shortcutButton,
  required = false,
  variant = "card",
  autoFocus = false,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const searchServerFn = useServerFn(searchLocationsServerFn);
  const detailsServerFn = useServerFn(getLocationDetailsServerFn);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestIdRef = useRef<number>(0);

  useEffect(() => () => {
    latestRequestIdRef.current += 1;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  // Sincroniza query local com valor externo se alterado
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Se houver coordenadas ou providerId selecionados externamente (ex. atalho STS), fecha edição
  useEffect(() => {
    if (selectedLocation?.providerId || (selectedLocation?.lat && selectedLocation?.lng)) {
      setIsEditing(false);
    }
  }, [selectedLocation?.providerId, selectedLocation?.lat, selectedLocation?.lng]);

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

      const cacheKey = trimmed.toLowerCase();
      if (CLIENT_LOCATION_CACHE.has(cacheKey)) {
        const cached = CLIENT_LOCATION_CACHE.get(cacheKey)!;
        setSuggestions(cached);
        setIsOpen(cached.length > 0);
        setIsLoading(false);
        return;
      }

      // Sugestões instantâneas locais (0ms)
      const catalogResults = searchCatalogLocations(trimmed);
      if (catalogResults.length > 0) {
        setSuggestions(catalogResults);
        setIsOpen(true);
      }

      setIsLoading(true);

      try {
        const response = await searchServerFn({ data: { query: trimmed } });

        // Descarta respostas obsoletas fora de ordem
        if (requestId !== latestRequestIdRef.current) return;

        const serverSuggestions = response?.suggestions || [];
        if (serverSuggestions.length > 0 || catalogResults.length > 0) {
          // Mescla resultados do Google Places com Catálogo Local, eliminando duplicatas
          const seen = new Set<string>();
          const combined: LocationSuggestion[] = [];

          // Pontuação de relevância para garantir que matches exatos como "Atacadão Maracanaú" fiquem no topo
          const tokens = trimmed
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .split(/\s+/)
            .filter(Boolean);

          const scoreItem = (item: LocationSuggestion): number => {
            const text = `${item.mainText} ${item.secondaryText || ""} ${item.formattedAddress}`
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

            const mainNorm = item.mainText
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

            let score = 0;
            if (mainNorm.startsWith(tokens[0] || "")) score += 30;
            if (text.includes(trimmed.toLowerCase())) score += 50;

            const matchedTokens = tokens.filter((t) => text.includes(t));
            if (matchedTokens.length === tokens.length) {
              score += 40;
            } else if (matchedTokens.length > 0) {
              score += (matchedTokens.length / tokens.length) * 20;
            }

            if (item.providerId?.startsWith("loc_")) score += 15; // Curadoria local oficial
            return score;
          };

          // Catálogo com match forte vem primeiro, mesclado com servidor
          const allCandidates = [...catalogResults, ...serverSuggestions];
          allCandidates.sort((a, b) => scoreItem(b) - scoreItem(a));

          for (const item of allCandidates) {
            const key = (item.formattedAddress || item.mainText).toLowerCase().trim();
            if (!seen.has(key)) {
              seen.add(key);
              combined.push(item);
            }
          }

          CLIENT_LOCATION_CACHE.set(cacheKey, combined);
          setSuggestions(combined);
          setIsOpen(combined.length > 0);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      } catch {
        if (requestId !== latestRequestIdRef.current) return;
        // Fallback gracioso: mantém resultados do catálogo caso existam
        if (catalogResults.length > 0) {
          setSuggestions(catalogResults);
          setIsOpen(true);
        }
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

    const trimmed = nextVal.trim();
    if (trimmed.length >= 2) {
      // Exibe catálogo instantaneamente enquanto a busca remota aguarda o debounce
      const instantCatalog = searchCatalogLocations(trimmed);
      if (instantCatalog.length > 0) {
        setSuggestions(instantCatalog);
        setIsOpen(true);
      }
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce ágil de 150ms para máxima rapidez
    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(nextVal);
    }, 150);
  };

  const handleSelectSuggestion = async (sug: LocationSuggestion) => {
    latestRequestIdRef.current += 1;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsOpen(false);
    setIsLoading(true);

    try {
      // Tenta obter detalhes com coordenadas e componentes exatos
      let details: LocationSuggestion = sug;
      if (sug.providerId && !sug.providerId.startsWith("loc_")) {
        const detailsResp = await detailsServerFn({ data: { placeId: sug.providerId } });
        if (detailsResp?.details) {
          details = detailsResp.details;
        }
      }

      const displayAddress = details.neighborhood || details.mainText || details.formattedAddress;
      setQuery(displayAddress);

      const locationDetails: FormLocationDetails = {
        rawText: query || displayAddress,
        formattedAddress: details.formattedAddress,
        city: details.city,
        state: details.state,
        neighborhood: details.neighborhood,
        lat: details.lat,
        lng: details.lng,
        providerId: details.providerId,
      };

      onChange(displayAddress, locationDetails);
      onSelect?.(displayAddress, locationDetails);
      setIsEditing(false);
    } catch {
      // Fallback usando a sugestão básica já recebida
      const displayAddress = sug.neighborhood || sug.mainText || sug.formattedAddress;
      setQuery(displayAddress);
      const fallbackDetails: FormLocationDetails = {
        rawText: query || displayAddress,
        formattedAddress: sug.formattedAddress,
        city: sug.city,
        state: sug.state,
        neighborhood: sug.neighborhood,
        lat: sug.lat,
        lng: sug.lng,
        providerId: sug.providerId,
      };
      onChange(displayAddress, fallbackDetails);
      onSelect?.(displayAddress, fallbackDetails);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    latestRequestIdRef.current += 1;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsLoading(false);
    setQuery("");
    onChange("", undefined);
    setSuggestions([]);
    setIsOpen(false);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  // Localização confirmada estruturada pronta para exibição no card
  const hasConfirmedSelection = Boolean(
    selectedLocation &&
    (selectedLocation.lat ||
      selectedLocation.providerId ||
      (selectedLocation.neighborhood && selectedLocation.city)),
  );

  return (
    <div className="relative space-y-1.5" ref={wrapperRef}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-semibold text-foreground">
            {label} {required ? "*" : ""}
          </label>
          {shortcutButton}
        </div>
      )}

      {variant === "card" && hasConfirmedSelection && !isEditing ? (
        /* Card com Local Encontrado, Preview de Mapa e Ação de Alterar */
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5 transition animate-in fade-in zoom-in-98 duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>📍 Local encontrado</span>
            </span>

            <button
              type="button"
              onClick={handleStartEditing}
              className="inline-flex items-center gap-1 text-xs font-semibold text-caronaa-primary-strong hover:underline hover:text-caronaa-primary transition"
              aria-label="Alterar localização selecionada"
            >
              <Edit2 size={12} />
              <span>Alterar localização</span>
            </button>
          </div>

          <div>
            <div className="font-semibold text-sm text-foreground">
              {formatSelectedTitle(selectedLocation!)}
            </div>
            {selectedLocation?.formattedAddress && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {selectedLocation.formattedAddress}
              </div>
            )}
          </div>

          {/* Mini preview de mapa quando houver coordenadas */}
          {selectedLocation?.lat && selectedLocation?.lng ? (
            <div className="relative mt-2 h-28 sm:h-32 w-full overflow-hidden rounded-lg border border-border bg-muted/40 shadow-inner">
              <iframe
                title="Visualização da localização no mapa"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedLocation.lng - 0.006}%2C${selectedLocation.lat - 0.005}%2C${selectedLocation.lng + 0.006}%2C${selectedLocation.lat + 0.005}&layer=mapnik&marker=${selectedLocation.lat}%2C${selectedLocation.lng}`}
                className="h-full w-full border-0 pointer-events-none opacity-90 contrast-[1.05]"
                loading="lazy"
              />
              <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-xs backdrop-blur-xs">
                <span>
                  {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
              <MapPin size={15} className="text-caronaa-primary-strong shrink-0" />
              <span>
                Localização aproximada definida: {selectedLocation?.city || "Fortaleza"},{" "}
                {selectedLocation?.state || "CE"}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Campo de Busca e Autocomplete */
        <>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-caronaa-primary-strong" />
              ) : (
                <MapPin size={17} />
              )}
            </div>

            <input
              ref={inputRef}
              id={id}
              type="text"
              autoFocus={autoFocus}
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (suggestions.length > 0) setIsOpen(true);
              }}
              placeholder={placeholder}
              autoComplete="off"
              className={
                variant === "glass"
                  ? "min-h-12 w-full rounded-2xl border border-white/15 bg-white/[.06] pl-10 pr-10 py-3 text-base text-white outline-none backdrop-blur-2xl placeholder:text-white/40 focus:border-[#FFBB00] focus:ring-2 focus:ring-[#FFBB00]/25"
                  : variant === "simple"
                    ? "h-11 w-full rounded-md border border-input bg-background pl-10 pr-9 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                    : "min-h-12 w-full rounded-xl border border-border bg-background pl-10 pr-10 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
              }
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

          <div className="flex items-center justify-between gap-2">
            {helperText ? (
              <p className="text-[11px] text-muted-foreground">{helperText}</p>
            ) : (
              <span />
            )}

            {hasConfirmedSelection && isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline transition"
              >
                Manter anterior
              </button>
            )}
          </div>

          {/* Dropdown de sugestões do autocomplete */}
          {isOpen && suggestions.length > 0 && (
            <div
              role="listbox"
              aria-label="Sugestões de localização"
              className={"absolute z-50 mt-1 max-h-[min(40dvh,240px)] w-full overflow-auto rounded-xl border p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150 " +
                (variant === "glass" ? "border-white/10 bg-[#242424] text-white backdrop-blur-2xl" : "border-border bg-card")}
            >
              <div className={"px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b flex items-center justify-between " +
                  (variant === "glass" ? "border-white/10 text-white/55" : "border-border/50 text-muted-foreground")}>
                <span>Locais sugeridos</span>
                <span className="text-[9px] font-normal text-muted-foreground/70">
                  Google & Catálogo CE
                </span>
              </div>
              {suggestions.map((sug, idx) => (
                <button
                  key={sug.providerId || idx}
                  type="button"
                  role="option"
                  onClick={() => void handleSelectSuggestion(sug)}
                  className={"flex min-h-11 w-full items-start gap-2.5 rounded-lg p-2.5 text-left text-sm transition focus:outline-none " +
                    (variant === "glass"
                      ? "text-white hover:bg-[#FFBB00]/10 focus:bg-[#FFBB00]/10"
                      : "hover:bg-caronaa-primary/10 hover:text-caronaa-dark dark:hover:text-caronaa-primary focus:bg-caronaa-primary/10")}
                >
                  <Search size={15} className="mt-0.5 shrink-0 text-caronaa-primary-strong" />
                  <div className="min-w-0 flex-1">
                    <div className={"truncate font-semibold " + (variant === "glass" ? "text-white" : "text-foreground")}>{sug.mainText}</div>
                    {sug.secondaryText ? (
                      <div className={"truncate text-xs " + (variant === "glass" ? "text-white/60" : "text-muted-foreground")}>
                        {sug.secondaryText}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
