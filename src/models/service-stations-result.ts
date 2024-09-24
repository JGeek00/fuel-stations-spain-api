export interface ServiceStationsResult {
  Fecha?:             string;
  ListaEESSPrecio?:   ListaEESSPrecio[];
  Nota?:              string;
  ResultadoConsulta?: string;
}

export interface ListaEESSPrecio {
  "C.P."?:                               string;
  Dirección?:                            string;
  Horario?:                              string;
  Latitud?:                              string;
  Localidad?:                            string;
  "Longitud (WGS84)"?:                   string;
  Margen?:                               Margen;
  Municipio?:                            string;
  "Precio Biodiesel"?:                   string;
  "Precio Bioetanol"?:                   string;
  "Precio Gas Natural Comprimido"?:      string;
  "Precio Gas Natural Licuado"?:         string;
  "Precio Gases licuados del petróleo"?: string;
  "Precio Gasoleo A"?:                   string;
  "Precio Gasoleo B"?:                   string;
  "Precio Gasoleo Premium"?:             string;
  "Precio Gasolina 95 E10"?:             string;
  "Precio Gasolina 95 E5"?:              string;
  "Precio Gasolina 95 E5 Premium"?:      string;
  "Precio Gasolina 98 E10"?:             string;
  "Precio Gasolina 98 E5"?:              string;
  "Precio Hidrogeno"?:                   string;
  Provincia?:                            Provincia;
  Remisión?:                             Remisión;
  Rótulo?:                               string;
  "Tipo Venta"?:                         TipoVenta;
  "% BioEtanol"?:                        string;
  "% Éster metílico"?:                   string;
  IDEESS?:                               string;
  IDMunicipio?:                          string;
  IDProvincia?:                          string;
  IDCCAA?:                               string;
}

export enum Margen {
  D = "D",
  I = "I",
  N = "N",
}

export enum Provincia {
  Albacete = "ALBACETE",
  Alicante = "ALICANTE",
  Almería = "ALMERÍA",
  ArabaÁlava = "ARABA/ÁLAVA",
  Asturias = "ASTURIAS",
  Badajoz = "BADAJOZ",
  BalearsIlles = "BALEARS (ILLES)",
  Barcelona = "BARCELONA",
  Bizkaia = "BIZKAIA",
  Burgos = "BURGOS",
  Cantabria = "CANTABRIA",
  CastellónCastelló = "CASTELLÓN / CASTELLÓ",
  Ceuta = "CEUTA",
  CiudadReal = "CIUDAD REAL",
  CoruñaA = "CORUÑA (A)",
  Cuenca = "CUENCA",
  Cáceres = "CÁCERES",
  Cádiz = "CÁDIZ",
  Córdoba = "CÓRDOBA",
  Gipuzkoa = "GIPUZKOA",
  Girona = "GIRONA",
  Granada = "GRANADA",
  Guadalajara = "GUADALAJARA",
  Huelva = "HUELVA",
  Huesca = "HUESCA",
  Jaén = "JAÉN",
  León = "LEÓN",
  Lleida = "LLEIDA",
  Lugo = "LUGO",
  Madrid = "MADRID",
  Melilla = "MELILLA",
  Murcia = "MURCIA",
  Málaga = "MÁLAGA",
  Navarra = "NAVARRA",
  Ourense = "OURENSE",
  Palencia = "PALENCIA",
  PalmasLas = "PALMAS (LAS)",
  Pontevedra = "PONTEVEDRA",
  RiojaLa = "RIOJA (LA)",
  Salamanca = "SALAMANCA",
  SantaCruzDeTenerife = "SANTA CRUZ DE TENERIFE",
  Segovia = "SEGOVIA",
  Sevilla = "SEVILLA",
  Soria = "SORIA",
  Tarragona = "TARRAGONA",
  Teruel = "TERUEL",
  Toledo = "TOLEDO",
  ValenciaValència = "VALENCIA / VALÈNCIA",
  Valladolid = "VALLADOLID",
  Zamora = "ZAMORA",
  Zaragoza = "ZARAGOZA",
  Ávila = "ÁVILA",
}

export enum Remisión {
  Dm = "dm",
  Om = "OM",
}

export enum TipoVenta {
  P = "P",
  R = "R",
}
