// The breed list behind onboarding's breed search and class fit (docs: breed-specific classes plan).
// PackPass owns it; partners never edit it. Classes match on aptitudes, so one tag covers many breeds
// and mixes. supabase/migrations/…_breeds.sql holds the same rows (scripts/gen-breeds.mjs writes it).

export type Aptitude =
  | 'herding' | 'sighthound' | 'scenthound' | 'retriever' | 'water' | 'terrier' | 'guardian' | 'bully' | 'toy' | 'companion';

export type SizeBand = 'toy' | 'small' | 'medium' | 'large' | 'giant';

export interface Breed {
  id: string;
  name: string;
  aliases: string[];
  aptitudes: Aptitude[];
  size: SizeBand;
}

export const APTITUDE_LABEL: Record<Aptitude, string> = {
  herding: 'Herding', sighthound: 'Sighthound', scenthound: 'Scenthound', retriever: 'Retriever', water: 'Water',
  terrier: 'Terrier', guardian: 'Guardian', bully: 'Bully', toy: 'Toy', companion: 'Companion',
};

type Row = [id: string, name: string, aptitudes: Aptitude[], size: SizeBand, aliases?: string[]];

const ROWS: Row[] = [
  // Herding
  ['australian-cattle-dog', 'Australian Cattle Dog', ['herding'], 'medium', ['Blue Heeler', 'Red Heeler', 'Heeler', 'ACD']],
  ['australian-shepherd', 'Australian Shepherd', ['herding'], 'medium', ['Aussie']],
  ['miniature-american-shepherd', 'Miniature American Shepherd', ['herding'], 'small', ['Mini Aussie', 'Miniature Australian Shepherd']],
  ['belgian-malinois', 'Belgian Malinois', ['herding', 'guardian'], 'large', ['Malinois', 'Mal']],
  ['belgian-tervuren', 'Belgian Tervuren', ['herding'], 'large', ['Tervuren']],
  ['bearded-collie', 'Bearded Collie', ['herding'], 'medium', ['Beardie']],
  ['border-collie', 'Border Collie', ['herding'], 'medium', ['Collie']],
  ['rough-collie', 'Rough Collie', ['herding'], 'large', ['Lassie collie']],
  ['shetland-sheepdog', 'Shetland Sheepdog', ['herding'], 'small', ['Sheltie']],
  ['german-shepherd', 'German Shepherd', ['herding', 'guardian'], 'large', ['GSD', 'Alsatian', 'German Shepherd Dog']],
  ['dutch-shepherd', 'Dutch Shepherd', ['herding', 'guardian'], 'large'],
  ['kelpie', 'Australian Kelpie', ['herding'], 'medium', ['Kelpie']],
  ['old-english-sheepdog', 'Old English Sheepdog', ['herding'], 'large'],
  ['pembroke-welsh-corgi', 'Pembroke Welsh Corgi', ['herding'], 'small', ['Corgi']],
  ['cardigan-welsh-corgi', 'Cardigan Welsh Corgi', ['herding'], 'small'],
  ['catahoula', 'Catahoula Leopard Dog', ['herding', 'scenthound'], 'large', ['Catahoula']],
  ['blue-lacy', 'Blue Lacy', ['herding', 'scenthound'], 'medium', ['Lacy dog']],
  ['english-shepherd', 'English Shepherd', ['herding'], 'medium'],
  ['puli', 'Puli', ['herding'], 'medium'],
  ['briard', 'Briard', ['herding'], 'large'],
  ['bouvier', 'Bouvier des Flandres', ['herding', 'guardian'], 'large', ['Bouvier']],
  // Sighthounds
  ['whippet', 'Whippet', ['sighthound'], 'medium'],
  ['greyhound', 'Greyhound', ['sighthound'], 'large'],
  ['italian-greyhound', 'Italian Greyhound', ['sighthound', 'toy'], 'toy', ['Iggy']],
  ['saluki', 'Saluki', ['sighthound'], 'large'],
  ['afghan-hound', 'Afghan Hound', ['sighthound'], 'large'],
  ['borzoi', 'Borzoi', ['sighthound'], 'giant'],
  ['irish-wolfhound', 'Irish Wolfhound', ['sighthound'], 'giant'],
  ['scottish-deerhound', 'Scottish Deerhound', ['sighthound'], 'giant', ['Deerhound']],
  ['basenji', 'Basenji', ['sighthound'], 'small'],
  ['pharaoh-hound', 'Pharaoh Hound', ['sighthound'], 'medium'],
  ['rhodesian-ridgeback', 'Rhodesian Ridgeback', ['sighthound', 'scenthound', 'guardian'], 'large', ['Ridgeback']],
  // Scenthounds
  ['beagle', 'Beagle', ['scenthound'], 'small'],
  ['basset-hound', 'Basset Hound', ['scenthound'], 'medium', ['Basset']],
  ['bloodhound', 'Bloodhound', ['scenthound'], 'large'],
  ['dachshund', 'Dachshund', ['scenthound', 'terrier'], 'small', ['Doxie', 'Wiener dog', 'Miniature Dachshund']],
  ['coonhound', 'Coonhound', ['scenthound'], 'large', ['Black and Tan Coonhound', 'Bluetick Coonhound', 'Redbone Coonhound', 'Treeing Walker Coonhound']],
  ['foxhound', 'American Foxhound', ['scenthound'], 'large', ['Foxhound']],
  ['harrier', 'Harrier', ['scenthound'], 'medium'],
  ['plott', 'Plott Hound', ['scenthound'], 'large', ['Plott']],
  ['petit-basset', 'Petit Basset Griffon Vendéen', ['scenthound'], 'small', ['PBGV']],
  // Retrievers, spaniels, pointers and water dogs
  ['labrador-retriever', 'Labrador Retriever', ['retriever', 'water'], 'large', ['Lab', 'Labrador']],
  ['golden-retriever', 'Golden Retriever', ['retriever', 'water'], 'large', ['Golden']],
  ['chesapeake-bay-retriever', 'Chesapeake Bay Retriever', ['retriever', 'water'], 'large', ['Chessie']],
  ['flat-coated-retriever', 'Flat-Coated Retriever', ['retriever', 'water'], 'large', ['Flat-coat']],
  ['nova-scotia-duck-tolling-retriever', 'Nova Scotia Duck Tolling Retriever', ['retriever', 'water'], 'medium', ['Toller']],
  ['portuguese-water-dog', 'Portuguese Water Dog', ['water', 'retriever'], 'medium', ['PWD', 'Portie']],
  ['newfoundland', 'Newfoundland', ['water', 'guardian'], 'giant', ['Newfie']],
  ['english-springer-spaniel', 'English Springer Spaniel', ['retriever', 'scenthound'], 'medium', ['Springer', 'Springer Spaniel']],
  ['cocker-spaniel', 'Cocker Spaniel', ['retriever', 'companion'], 'small', ['Cocker', 'English Cocker Spaniel', 'American Cocker Spaniel']],
  ['brittany', 'Brittany', ['retriever', 'scenthound'], 'medium', ['Brittany Spaniel']],
  ['boykin-spaniel', 'Boykin Spaniel', ['retriever', 'water'], 'medium', ['Boykin']],
  ['german-shorthaired-pointer', 'German Shorthaired Pointer', ['retriever', 'scenthound', 'water'], 'large', ['GSP', 'Shorthair']],
  ['german-wirehaired-pointer', 'German Wirehaired Pointer', ['retriever', 'scenthound', 'water'], 'large', ['GWP']],
  ['vizsla', 'Vizsla', ['retriever', 'scenthound'], 'medium'],
  ['weimaraner', 'Weimaraner', ['retriever', 'scenthound'], 'large', ['Weim']],
  ['english-setter', 'English Setter', ['retriever', 'scenthound'], 'large', ['Setter']],
  ['irish-setter', 'Irish Setter', ['retriever', 'scenthound'], 'large', ['Red Setter']],
  ['pointer', 'Pointer', ['retriever', 'scenthound'], 'large', ['English Pointer']],
  // Terriers
  ['jack-russell-terrier', 'Jack Russell Terrier', ['terrier'], 'small', ['Jack Russell', 'JRT', 'Parson Russell Terrier']],
  ['rat-terrier', 'Rat Terrier', ['terrier'], 'small'],
  ['border-terrier', 'Border Terrier', ['terrier'], 'small'],
  ['cairn-terrier', 'Cairn Terrier', ['terrier'], 'small', ['Cairn']],
  ['west-highland-white-terrier', 'West Highland White Terrier', ['terrier'], 'small', ['Westie']],
  ['scottish-terrier', 'Scottish Terrier', ['terrier'], 'small', ['Scottie']],
  ['schnauzer-miniature', 'Miniature Schnauzer', ['terrier', 'companion'], 'small', ['Schnauzer', 'Mini Schnauzer']],
  ['standard-schnauzer', 'Standard Schnauzer', ['terrier', 'guardian'], 'medium'],
  ['giant-schnauzer', 'Giant Schnauzer', ['guardian'], 'large'],
  ['airedale-terrier', 'Airedale Terrier', ['terrier'], 'large', ['Airedale']],
  ['wheaten-terrier', 'Soft Coated Wheaten Terrier', ['terrier', 'companion'], 'medium', ['Wheaten']],
  ['fox-terrier', 'Fox Terrier', ['terrier'], 'small', ['Wire Fox Terrier', 'Smooth Fox Terrier']],
  ['bull-terrier', 'Bull Terrier', ['terrier', 'bully'], 'medium'],
  ['yorkshire-terrier', 'Yorkshire Terrier', ['terrier', 'toy'], 'toy', ['Yorkie']],
  // Bully breeds
  ['american-pit-bull-terrier', 'American Pit Bull Terrier', ['bully', 'terrier'], 'medium', ['Pit Bull', 'Pitbull', 'Pittie']],
  ['american-staffordshire-terrier', 'American Staffordshire Terrier', ['bully', 'terrier'], 'medium', ['AmStaff', 'Staffy']],
  ['staffordshire-bull-terrier', 'Staffordshire Bull Terrier', ['bully', 'terrier'], 'medium', ['Staffie']],
  ['american-bulldog', 'American Bulldog', ['bully', 'guardian'], 'large'],
  ['american-bully', 'American Bully', ['bully'], 'medium', ['Bully']],
  ['boxer', 'Boxer', ['bully', 'guardian'], 'large'],
  ['bulldog', 'Bulldog', ['bully', 'companion'], 'medium', ['English Bulldog']],
  ['french-bulldog', 'French Bulldog', ['bully', 'companion'], 'small', ['Frenchie']],
  ['boston-terrier', 'Boston Terrier', ['bully', 'companion'], 'small', ['Boston']],
  ['cane-corso', 'Cane Corso', ['guardian', 'bully'], 'giant', ['Corso']],
  // Guardians and working dogs
  ['rottweiler', 'Rottweiler', ['guardian'], 'large', ['Rottie']],
  ['doberman', 'Doberman Pinscher', ['guardian'], 'large', ['Doberman', 'Dobie']],
  ['great-dane', 'Great Dane', ['guardian'], 'giant', ['Dane']],
  ['mastiff', 'Mastiff', ['guardian'], 'giant', ['English Mastiff', 'Bullmastiff']],
  ['great-pyrenees', 'Great Pyrenees', ['guardian'], 'giant', ['Pyr', 'Pyrenees']],
  ['anatolian-shepherd', 'Anatolian Shepherd', ['guardian'], 'giant', ['Anatolian', 'Kangal']],
  ['bernese-mountain-dog', 'Bernese Mountain Dog', ['guardian', 'companion'], 'giant', ['Berner', 'Bernese']],
  ['saint-bernard', 'Saint Bernard', ['guardian'], 'giant', ['St. Bernard']],
  ['akita', 'Akita', ['guardian'], 'large'],
  ['siberian-husky', 'Siberian Husky', ['guardian'], 'medium', ['Husky']],
  ['alaskan-malamute', 'Alaskan Malamute', ['guardian'], 'large', ['Malamute']],
  ['samoyed', 'Samoyed', ['herding', 'companion'], 'medium', ['Sammy']],
  ['shiba-inu', 'Shiba Inu', ['companion'], 'small', ['Shiba']],
  ['chow-chow', 'Chow Chow', ['guardian', 'companion'], 'medium', ['Chow']],
  // Poodles and doodles
  ['standard-poodle', 'Standard Poodle', ['retriever', 'water', 'companion'], 'medium', ['Poodle']],
  ['miniature-poodle', 'Miniature Poodle', ['companion'], 'small', ['Mini Poodle']],
  ['toy-poodle', 'Toy Poodle', ['toy', 'companion'], 'toy'],
  ['goldendoodle', 'Goldendoodle', ['retriever', 'water', 'companion'], 'medium', ['Groodle', 'Doodle']],
  ['labradoodle', 'Labradoodle', ['retriever', 'water', 'companion'], 'medium', ['Doodle']],
  ['bernedoodle', 'Bernedoodle', ['companion', 'guardian'], 'large'],
  ['aussiedoodle', 'Aussiedoodle', ['herding', 'companion'], 'medium'],
  ['cockapoo', 'Cockapoo', ['companion'], 'small'],
  // Toy and companion
  ['chihuahua', 'Chihuahua', ['toy', 'companion'], 'toy', ['Chi']],
  ['pomeranian', 'Pomeranian', ['toy', 'companion'], 'toy', ['Pom']],
  ['maltese', 'Maltese', ['toy', 'companion'], 'toy'],
  ['shih-tzu', 'Shih Tzu', ['toy', 'companion'], 'small'],
  ['pug', 'Pug', ['toy', 'companion'], 'small'],
  ['papillon', 'Papillon', ['toy', 'companion'], 'toy'],
  ['havanese', 'Havanese', ['toy', 'companion'], 'small'],
  ['cavalier-king-charles-spaniel', 'Cavalier King Charles Spaniel', ['toy', 'companion'], 'small', ['Cavalier', 'CKCS']],
  ['bichon-frise', 'Bichon Frise', ['companion'], 'small', ['Bichon']],
  ['miniature-pinscher', 'Miniature Pinscher', ['toy'], 'toy', ['Min Pin']],
  ['lhasa-apso', 'Lhasa Apso', ['companion'], 'small', ['Lhasa']],
  ['dalmatian', 'Dalmatian', ['companion', 'scenthound'], 'large', ['Dal']],
];

export const BREEDS: Breed[] = ROWS.map(([id, name, aptitudes, size, aliases = []]) => ({ id, name, aliases, aptitudes, size }));
export const breedById: Record<string, Breed> = Object.fromEntries(BREEDS.map((b) => [b.id, b]));

/** Up to `limit` breeds matching a search, names that start with the query first. */
export function searchBreeds(query: string, limit = 6): Breed[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const score = (b: Breed) => {
    const names = [b.name, ...b.aliases].map((n) => n.toLowerCase());
    if (names.some((n) => n === q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    if (names.some((n) => n.split(/[\s-]+/).some((w) => w.startsWith(q)))) return 2;
    if (names.some((n) => n.includes(q))) return 3;
    return 9;
  };
  return BREEDS.map((b) => [score(b), b] as const).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map(([, b]) => b);
}

/** The breed a typed name means, when it names one exactly (a name or an alias). */
export const breedNamed = (name: string) => {
  const q = name.trim().toLowerCase();
  return q ? BREEDS.find((b) => b.name.toLowerCase() === q || b.aliases.some((a) => a.toLowerCase() === q)) : undefined;
};

/** How a dog's breeds read: "Border Collie", "Mixed: Lab and Border Collie", "Mixed breed". */
export function breedLabel(ids: string[], mixed: boolean, fallback = '') {
  const names = ids.map((id) => breedById[id]?.name).filter(Boolean) as string[];
  if (!mixed) return names[0] ?? fallback;
  if (!names.length) return 'Mixed breed';
  return `${names.join(' and ')} mix`;
}
