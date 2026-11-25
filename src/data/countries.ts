import type { Continent } from "../types";

// Countries for the leaderboard's location scopes (#96): ISO code, name, continent, and the capital's
// latitude, which decides the hemisphere. No GPS and no city lookup. `crossesEquator` countries have
// land on both sides, so the player picks their hemisphere instead.
// Transcontinental countries are filed under where most of their people live (Russia in Europe,
// Turkey in Asia, Egypt in Africa, Kazakhstan in Asia).

export interface Country {
  code: string;
  name: string;
  continent: Continent;
  /** Latitude of the capital, in degrees. Negative is south. */
  capitalLat: number;
  crossesEquator?: boolean;
}

type Row = [code: string, name: string, continent: Continent, capitalLat: number, crosses?: 1];

const ROWS: Row[] = [
  // Europe
  ["AL", "Albania", "EU", 41.3], ["AD", "Andorra", "EU", 42.5], ["AT", "Austria", "EU", 48.2], ["BY", "Belarus", "EU", 53.9],
  ["BE", "Belgium", "EU", 50.8], ["BA", "Bosnia and Herzegovina", "EU", 43.9], ["BG", "Bulgaria", "EU", 42.7], ["HR", "Croatia", "EU", 45.8],
  ["CY", "Cyprus", "EU", 35.2], ["CZ", "Czechia", "EU", 50.1], ["DK", "Denmark", "EU", 55.7], ["EE", "Estonia", "EU", 59.4],
  ["FI", "Finland", "EU", 60.2], ["FR", "France", "EU", 48.9], ["DE", "Germany", "EU", 52.5], ["GR", "Greece", "EU", 38.0],
  ["HU", "Hungary", "EU", 47.5], ["IS", "Iceland", "EU", 64.1], ["IE", "Ireland", "EU", 53.3], ["IT", "Italy", "EU", 41.9],
  ["XK", "Kosovo", "EU", 42.7], ["LV", "Latvia", "EU", 56.9], ["LI", "Liechtenstein", "EU", 47.1], ["LT", "Lithuania", "EU", 54.7],
  ["LU", "Luxembourg", "EU", 49.6], ["MT", "Malta", "EU", 35.9], ["MD", "Moldova", "EU", 47.0], ["MC", "Monaco", "EU", 43.7],
  ["ME", "Montenegro", "EU", 42.4], ["NL", "Netherlands", "EU", 52.4], ["MK", "North Macedonia", "EU", 42.0], ["NO", "Norway", "EU", 59.9],
  ["PL", "Poland", "EU", 52.2], ["PT", "Portugal", "EU", 38.7], ["RO", "Romania", "EU", 44.4], ["RU", "Russia", "EU", 55.8],
  ["SM", "San Marino", "EU", 43.9], ["RS", "Serbia", "EU", 44.8], ["SK", "Slovakia", "EU", 48.1], ["SI", "Slovenia", "EU", 46.1],
  ["ES", "Spain", "EU", 40.4], ["SE", "Sweden", "EU", 59.3], ["CH", "Switzerland", "EU", 46.9], ["UA", "Ukraine", "EU", 50.5],
  ["GB", "United Kingdom", "EU", 51.5], ["VA", "Vatican City", "EU", 41.9],
  // Asia
  ["AF", "Afghanistan", "AS", 34.5], ["AM", "Armenia", "AS", 40.2], ["AZ", "Azerbaijan", "AS", 40.4], ["BH", "Bahrain", "AS", 26.2],
  ["BD", "Bangladesh", "AS", 23.8], ["BT", "Bhutan", "AS", 27.5], ["BN", "Brunei", "AS", 4.9], ["KH", "Cambodia", "AS", 11.6],
  ["CN", "China", "AS", 39.9], ["GE", "Georgia", "AS", 41.7], ["IN", "India", "AS", 28.6], ["ID", "Indonesia", "AS", -6.2, 1],
  ["IR", "Iran", "AS", 35.7], ["IQ", "Iraq", "AS", 33.3], ["IL", "Israel", "AS", 31.8], ["JP", "Japan", "AS", 35.7],
  ["JO", "Jordan", "AS", 31.9], ["KZ", "Kazakhstan", "AS", 51.2], ["KW", "Kuwait", "AS", 29.4], ["KG", "Kyrgyzstan", "AS", 42.9],
  ["LA", "Laos", "AS", 18.0], ["LB", "Lebanon", "AS", 33.9], ["MY", "Malaysia", "AS", 3.1], ["MV", "Maldives", "AS", 4.2, 1],
  ["MN", "Mongolia", "AS", 47.9], ["MM", "Myanmar", "AS", 19.8], ["NP", "Nepal", "AS", 27.7], ["KP", "North Korea", "AS", 39.0],
  ["OM", "Oman", "AS", 23.6], ["PK", "Pakistan", "AS", 33.7], ["PS", "Palestine", "AS", 31.9], ["PH", "Philippines", "AS", 14.6],
  ["QA", "Qatar", "AS", 25.3], ["SA", "Saudi Arabia", "AS", 24.7], ["SG", "Singapore", "AS", 1.3], ["KR", "South Korea", "AS", 37.6],
  ["LK", "Sri Lanka", "AS", 6.9], ["SY", "Syria", "AS", 33.5], ["TW", "Taiwan", "AS", 25.0], ["TJ", "Tajikistan", "AS", 38.6],
  ["TH", "Thailand", "AS", 13.8], ["TL", "Timor-Leste", "AS", -8.6], ["TR", "Turkey", "AS", 39.9], ["TM", "Turkmenistan", "AS", 37.9],
  ["AE", "United Arab Emirates", "AS", 24.5], ["UZ", "Uzbekistan", "AS", 41.3], ["VN", "Vietnam", "AS", 21.0], ["YE", "Yemen", "AS", 15.4],
  // Africa
  ["DZ", "Algeria", "AF", 36.8], ["AO", "Angola", "AF", -8.8], ["BJ", "Benin", "AF", 6.5], ["BW", "Botswana", "AF", -24.7],
  ["BF", "Burkina Faso", "AF", 12.4], ["BI", "Burundi", "AF", -3.4], ["CV", "Cabo Verde", "AF", 14.9], ["CM", "Cameroon", "AF", 3.9],
  ["CF", "Central African Republic", "AF", 4.4], ["TD", "Chad", "AF", 12.1], ["KM", "Comoros", "AF", -11.7], ["CG", "Congo", "AF", -4.3, 1],
  ["CD", "DR Congo", "AF", -4.3, 1], ["CI", "Côte d'Ivoire", "AF", 6.8], ["DJ", "Djibouti", "AF", 11.6], ["EG", "Egypt", "AF", 30.0],
  ["GQ", "Equatorial Guinea", "AF", 3.8, 1], ["ER", "Eritrea", "AF", 15.3], ["SZ", "Eswatini", "AF", -26.3], ["ET", "Ethiopia", "AF", 9.0],
  ["GA", "Gabon", "AF", 0.4, 1], ["GM", "Gambia", "AF", 13.5], ["GH", "Ghana", "AF", 5.6], ["GN", "Guinea", "AF", 9.5],
  ["GW", "Guinea-Bissau", "AF", 11.9], ["KE", "Kenya", "AF", -1.3, 1], ["LS", "Lesotho", "AF", -29.3], ["LR", "Liberia", "AF", 6.3],
  ["LY", "Libya", "AF", 32.9], ["MG", "Madagascar", "AF", -18.9], ["MW", "Malawi", "AF", -14.0], ["ML", "Mali", "AF", 12.6],
  ["MR", "Mauritania", "AF", 18.1], ["MU", "Mauritius", "AF", -20.2], ["MA", "Morocco", "AF", 34.0], ["MZ", "Mozambique", "AF", -25.97],
  ["NA", "Namibia", "AF", -22.6], ["NE", "Niger", "AF", 13.5], ["NG", "Nigeria", "AF", 9.1], ["RW", "Rwanda", "AF", -1.9],
  ["ST", "São Tomé and Príncipe", "AF", 0.3, 1], ["SN", "Senegal", "AF", 14.7], ["SC", "Seychelles", "AF", -4.6], ["SL", "Sierra Leone", "AF", 8.5],
  ["SO", "Somalia", "AF", 2.0, 1], ["ZA", "South Africa", "AF", -25.7], ["SS", "South Sudan", "AF", 4.9], ["SD", "Sudan", "AF", 15.6],
  ["TZ", "Tanzania", "AF", -6.2], ["TG", "Togo", "AF", 6.1], ["TN", "Tunisia", "AF", 36.8], ["UG", "Uganda", "AF", 0.3, 1],
  ["ZM", "Zambia", "AF", -15.4], ["ZW", "Zimbabwe", "AF", -17.8],
  // North America, with Central America and the Caribbean
  ["AG", "Antigua and Barbuda", "NA", 17.1], ["BS", "Bahamas", "NA", 25.0], ["BB", "Barbados", "NA", 13.1], ["BZ", "Belize", "NA", 17.3],
  ["CA", "Canada", "NA", 45.4], ["CR", "Costa Rica", "NA", 9.9], ["CU", "Cuba", "NA", 23.1], ["DM", "Dominica", "NA", 15.3],
  ["DO", "Dominican Republic", "NA", 18.5], ["SV", "El Salvador", "NA", 13.7], ["GD", "Grenada", "NA", 12.1], ["GT", "Guatemala", "NA", 14.6],
  ["HT", "Haiti", "NA", 18.5], ["HN", "Honduras", "NA", 14.1], ["JM", "Jamaica", "NA", 18.0], ["MX", "Mexico", "NA", 19.4],
  ["NI", "Nicaragua", "NA", 12.1], ["PA", "Panama", "NA", 9.0], ["KN", "Saint Kitts and Nevis", "NA", 17.3], ["LC", "Saint Lucia", "NA", 14.0],
  ["VC", "Saint Vincent and the Grenadines", "NA", 13.2], ["TT", "Trinidad and Tobago", "NA", 10.7], ["US", "United States", "NA", 38.9],
  // South America
  ["AR", "Argentina", "SA", -34.6], ["BO", "Bolivia", "SA", -16.5], ["BR", "Brazil", "SA", -15.8, 1], ["CL", "Chile", "SA", -33.4],
  ["CO", "Colombia", "SA", 4.7, 1], ["EC", "Ecuador", "SA", -0.2, 1], ["GY", "Guyana", "SA", 6.8], ["PY", "Paraguay", "SA", -25.3],
  ["PE", "Peru", "SA", -12.0], ["SR", "Suriname", "SA", 5.9], ["UY", "Uruguay", "SA", -34.9], ["VE", "Venezuela", "SA", 10.5],
  // Oceania
  ["AU", "Australia", "OC", -35.3], ["FJ", "Fiji", "OC", -18.1], ["KI", "Kiribati", "OC", 1.4, 1], ["MH", "Marshall Islands", "OC", 7.1],
  ["FM", "Micronesia", "OC", 6.9], ["NR", "Nauru", "OC", -0.5, 1], ["NZ", "New Zealand", "OC", -41.3], ["PW", "Palau", "OC", 7.5],
  ["PG", "Papua New Guinea", "OC", -9.4], ["WS", "Samoa", "OC", -13.8], ["SB", "Solomon Islands", "OC", -9.4], ["TO", "Tonga", "OC", -21.1],
  ["TV", "Tuvalu", "OC", -8.5], ["VU", "Vanuatu", "OC", -17.7],
];

export const countries: Country[] = ROWS.map(([code, name, continent, capitalLat, crosses]) => ({
  code,
  name,
  continent,
  capitalLat,
  ...(crosses ? { crossesEquator: true } : {}),
}));

const byCode = new Map(countries.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}
