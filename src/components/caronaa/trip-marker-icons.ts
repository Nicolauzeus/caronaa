/**
 * CARONAA trip markers. These SVGs contain only trusted, static literals: no
 * API address or user-provided text is interpolated into a data URL.
 * A readable label + distinct pictogram avoids color-only identification.
 */
export type TripMarkerKind =
  | "you" | "driver" | "passenger" | "destination" | "meeting" | "origin" | "availableDriver" | "availableMoto"
  | "adminAvailableCar" | "adminAvailableMoto" | "adminInTripCar" | "adminInTripMoto" | "adminWaitingPassenger";

type MarkerDesign = {
  text: string;
  background: string;
  foreground: string;
  border: string;
  iconBackground: string;
  iconForeground: string;
  glyph: "person" | "car" | "moto" | "flag" | "pin";
};

const designs: Record<Exclude<TripMarkerKind, "availableDriver" | "availableMoto" | "adminAvailableCar" | "adminAvailableMoto" | "adminInTripCar" | "adminInTripMoto" | "adminWaitingPassenger">, MarkerDesign> = {
  you: {
    text: "Você", background: "#2563EB", foreground: "#FFFFFF",
    border: "#FFFFFF", iconBackground: "#FFFFFF", iconForeground: "#2563EB", glyph: "person",
  },
  driver: {
    text: "Motorista", background: "#121212", foreground: "#FFBB00",
    border: "#FFBB00", iconBackground: "#FFBB00", iconForeground: "#121212", glyph: "car",
  },
  passenger: {
    text: "Passageiro", background: "#0F766E", foreground: "#FFFFFF",
    border: "#FFFFFF", iconBackground: "#FFFFFF", iconForeground: "#0F766E", glyph: "person",
  },
  destination: {
    text: "Destino", background: "#FFBB00", foreground: "#121212",
    border: "#121212", iconBackground: "#121212", iconForeground: "#FFBB00", glyph: "flag",
  },
  meeting: {
    text: "Embarque", background: "#FFFFFF", foreground: "#121212",
    border: "#121212", iconBackground: "#121212", iconForeground: "#FFFFFF", glyph: "pin",
  },
  origin: {
    text: "Origem", background: "#FFFFFF", foreground: "#121212",
    border: "#121212", iconBackground: "#121212", iconForeground: "#FFFFFF", glyph: "pin",
  },
};

function glyphPath(glyph: MarkerDesign["glyph"]): string {
  if (glyph === "person")
    return '<circle cx="24" cy="17" r="4" /><path d="M15 31c0-6 3.5-9 9-9s9 3 9 9v1H15z" />';
  if (glyph === "car")
    return '<path d="M13 24l3-8h16l3 8v9H13z" /><path d="M16 24h16" stroke="#121212" stroke-width="1.7" fill="none" /><circle cx="18" cy="31" r="2" fill="#121212" /><circle cx="30" cy="31" r="2" fill="#121212" />';
  if (glyph === "moto")
    return '<circle cx="16" cy="27" r="4.5" fill="none" stroke="#FFBB00" stroke-width="2.2" />' +
      '<circle cx="32" cy="27" r="4.5" fill="none" stroke="#FFBB00" stroke-width="2.2" />' +
      '<path d="M16 27l5-8h6l3 5h4" fill="none" stroke="#FFBB00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />' +
      '<path d="M21 19l4 8" stroke="#FFBB00" stroke-width="2" />' +
      '<circle cx="28" cy="15" r="2" fill="#FFBB00" />' +
      '<path d="M24 16h6" stroke="#FFBB00" stroke-width="2" stroke-linecap="round" />';
  if (glyph === "flag")
    return '<path d="M18 13v20h2V13zM20 14h13l-3 5 3 5H20z" />';
  return '<path d="M24 12c-6 0-10 4.1-10 9.5 0 6.5 10 13.5 10 13.5s10-7 10-13.5c0-5.4-4-9.5-10-9.5zm0 13a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />';
}

export function tripMarkerSvg(kind: TripMarkerKind): string {
  if (kind === "adminAvailableCar" || kind === "adminAvailableMoto" ||
      kind === "adminInTripCar" || kind === "adminInTripMoto" || kind === "adminWaitingPassenger") {
    const fill=kind==="adminInTripCar"||kind==="adminInTripMoto"?"#2563EB":
      kind==="adminWaitingPassenger"?"#FFBB00":"#16A34A";
    const ink=kind==="adminWaitingPassenger"?"#121212":"#FFFFFF";
    const glyph=kind==="adminAvailableMoto"||kind==="adminInTripMoto"?"moto":
      kind==="adminWaitingPassenger"?"person":"car";
    const glyphMarkup=kind==="adminAvailableMoto"||kind==="adminInTripMoto"
      ? '<g fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round">' +
        '<circle cx="16" cy="28" r="4.5"/><circle cx="32" cy="28" r="4.5"/>' +
        '<path d="M16 28l5-8h7l4 8m-11-8l4 8m1-12h5"/></g>'
      : '<g fill="'+ink+'">' + glyphPath(glyph) + '</g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="54" viewBox="0 0 48 54">' +
      '<path d="M24 52L16 40h16z" fill="'+fill+'" stroke="#FFFFFF" stroke-width="1.5"/>' +
      '<circle cx="24" cy="23" r="20" fill="'+fill+'" stroke="#FFFFFF" stroke-width="3"/>' +
      glyphMarkup + '</svg>';
  }
  if (kind === "availableDriver" || kind === "availableMoto") {
    const design = designs.driver;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="54" viewBox="0 0 48 54" role="img">' +
      '<path d="M24 52L16 40h16z" fill="#FFBB00" stroke="#121212" stroke-width="2"/>' +
      '<circle cx="24" cy="23" r="20" fill="#121212" stroke="#FFBB00" stroke-width="3"/>' +
      '<g fill="' + design.iconBackground + '">' + glyphPath(kind === "availableMoto" ? "moto" : "car") + '</g></svg>';
  }
  const d = designs[kind];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="124" height="58" viewBox="0 0 124 58" role="img">' +
    '<path d="M62 55l-8-12h16z" fill="' + d.background + '" stroke="' + d.border + '" stroke-width="2"/>' +
    '<rect x="2" y="2" width="120" height="43" rx="21.5" fill="' + d.background + '" stroke="' + d.border + '" stroke-width="2.5"/>' +
    '<circle cx="24" cy="23.5" r="17" fill="' + d.iconBackground + '"/>' +
    '<g fill="' + d.iconForeground + '">' + glyphPath(d.glyph) + '</g>' +
    '<text x="46" y="28" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="' + d.foreground + '">' +
    d.text + '</text></svg>';
}

export function tripMarkerIcon(kind: TripMarkerKind): { url: string } {
  return { url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(tripMarkerSvg(kind)) };
}
