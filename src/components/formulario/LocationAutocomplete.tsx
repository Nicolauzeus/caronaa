import React, { useState, useEffect, useRef } from "react";
import { MapPin, Search, CheckCircle2, X } from "lucide-react";
import { searchLocations, LocationSuggestion } from "@/lib/geocoding";

interface LocationAutocompleteProps {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  onChange: (value: string, suggestion?: LocationSuggestion) => void;
  helperText?: string;
}

export function LocationAutocomplete({
  id,
  label,
  value = "",
  placeholder = "Digite o bairro, rua ou ponto de referência...",
  onChange,
  helperText,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setQuery(nextVal);
    onChange(nextVal);
    setSelectedLocation(null);

    if (nextVal.trim().length >= 2) {
      const results = await searchLocations(nextVal);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (sug: LocationSuggestion) => {
    setQuery(sug.neighborhood || sug.formattedAddress);
    setSelectedLocation(sug);
    setIsOpen(false);
    onChange(sug.neighborhood || sug.formattedAddress, sug);
  };

  return (
    <div className="relative space-y-2" ref={wrapperRef}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {selectedLocation && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={13} />
            Encontramos este local
          </span>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
          <MapPin size={18} />
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
          className="min-h-12 w-full rounded-xl border bg-background pl-10 pr-10 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedLocation(null);
              onChange("");
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
            aria-label="Limpar endereço"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          <div className="p-1.5">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sugestões encontradas
            </div>
            {suggestions.map((sug, idx) => (
              <button
                key={sug.providerId ?? idx}
                type="button"
                onClick={() => handleSelect(sug)}
                className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left text-sm transition hover:bg-caronaa-primary/10 hover:text-caronaa-dark dark:hover:text-caronaa-primary focus:bg-caronaa-primary/10"
              >
                <Search size={15} className="mt-0.5 shrink-0 text-caronaa-primary" />
                <div>
                  <div className="font-semibold text-foreground">
                    {sug.neighborhood} - {sug.city}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {sug.formattedAddress}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedLocation && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              📍 {selectedLocation.neighborhood}, {selectedLocation.city} - {selectedLocation.state}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Apenas o bairro aproximado será visível
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
