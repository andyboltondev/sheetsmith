// Small text helpers shared by the page (which cannot load the PDF engine) and every sheet style.
export const signed = value => value >= 0 ? `+${value}` : String(value);
export const ordinal = n => n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]??'th');
export const PROFICIENCY_ONLY = 'Included in proficiencies.';
