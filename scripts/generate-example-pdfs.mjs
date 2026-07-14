import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const outputDir = path.resolve("sample-data", "pdf-examples");
fs.mkdirSync(outputDir, { recursive: true });

const firstNames = [
  "Ava","Liam","Mia","Noah","Olivia","Ethan","Sophia","Lucas","Isla","Mason",
  "Amelia","Elijah","Harper","James","Charlotte","Benjamin","Evelyn","Logan","Ella","Henry",
  "Grace","Daniel","Chloe","Jackson","Lily","Sebastian","Zoe","Aiden","Nora","Matthew",
  "Hannah","David","Aria","Joseph","Riley","Samuel","Scarlett","Owen","Victoria","Caleb",
  "Aurora","Ryan","Penelope","Nathan","Layla","Isaiah","Stella","Eli","Claire","Anthony",
  "Sofia","Joshua","Eleanor","Andrew","Hazel","Christopher","Luna","Dylan","Camila","Isaac",
  "Ellie","Gabriel","Violet","Julian","Paisley","Levi","Savannah","Lincoln","Brooklyn","Jaxon",
  "Bella","Jayden","Genesis","Grayson","Audrey","Hunter","Leah","Connor","Maya","Dominic",
  "Naomi","Austin","Elena","John","Aaliyah","Gavin","Samantha","Carlos","Valentina","Marcus",
  "Jasmine","Kevin","Destiny","Brandon","Miranda","Tyler","Diana","Patrick","Rosa","Kenneth"
];

const middleNames = [
  "Jean","Marie","Ann","Lee","Rose","Lynn","Kay","Grace","Mae","Sue",
  "James","Michael","Robert","William","Thomas","Ray","Dale","Wayne","Scott","Dean",
  "Elizabeth","Nicole","Christine","Michelle","Patricia","Renee","Louise","Frances","Teresa","Anne"
];

const lastNames = [
  "Turner","Brooks","Morris","Diaz","Reed","Coleman","Foster","Kelly","Hayes","Bennett",
  "Sanders","Price","Patel","Sharma","Nguyen","Rogers","Campbell","Parker","Edwards","Howard",
  "Stewart","Flores","Morris","Gibson","Mitchell","Ross","Cooper","Richardson","Cox","Ward",
  "Torres","Peterson","Gray","Ramirez","James","Watson","Brooks","Kelly","Sanders","Price",
  "Hernandez","Murphy","Rivera","Cook","Bailey","Bell","Gonzalez","Ortiz","Chen","Kim",
  "Lee","Wang","Singh","Ahmed","Johnson","Williams","Brown","Jones","Miller","Davis",
  "Garcia","Wilson","Anderson","Taylor","Thomas","Jackson","White","Harris","Martin","Thompson",
  "Martinez","Robinson","Clark","Rodriguez","Lewis","Walker","Hall","Allen","Young","King",
  "Wright","Scott","Green","Baker","Adams","Nelson","Carter","Perez","Roberts","Turner"
];

const streetNames = [
  "Maple Ave","Oak Street","Cedar Lane","Elm Drive","Willow Way","Pine Road","Birch Blvd",
  "Lakeview Terrace","Sunrise Drive","Sunset Blvd","River Road","Forest Path","Meadow Lane",
  "Hillside Drive","Valley Road","Creekside Way","Garden Court","Highland Ave","Parkview Dr",
  "Liberty Street","Heritage Lane","Cambridge Drive","Oxford Road","Fairview Ave","Orchard Lane"
];

const locationData = [
  { city: "Seattle",       state: "WA", zips: ["98101","98102","98103","98104","98105"] },
  { city: "Austin",        state: "TX", zips: ["78701","78702","78703","78704","78705"] },
  { city: "Denver",        state: "CO", zips: ["80201","80202","80203","80204","80205"] },
  { city: "Phoenix",       state: "AZ", zips: ["85001","85002","85003","85004","85005"] },
  { city: "Boston",        state: "MA", zips: ["02101","02102","02103","02104","02105"] },
  { city: "Chicago",       state: "IL", zips: ["60601","60602","60603","60604","60605"] },
  { city: "Atlanta",       state: "GA", zips: ["30301","30302","30303","30304","30305"] },
  { city: "San Diego",     state: "CA", zips: ["92101","92102","92103","92104","92105"] },
  { city: "Houston",       state: "TX", zips: ["77001","77002","77003","77004","77005"] },
  { city: "Dallas",        state: "TX", zips: ["75201","75202","75203","75204","75205"] },
  { city: "Frisco",        state: "TX", zips: ["75034","75035","75036"] },
  { city: "Miami",         state: "FL", zips: ["33101","33102","33103","33104","33105"] },
  { city: "Orlando",       state: "FL", zips: ["32801","32802","32803","32804","32805"] },
  { city: "Nashville",     state: "TN", zips: ["37201","37202","37203","37204","37205"] },
  { city: "Minneapolis",   state: "MN", zips: ["55401","55402","55403","55404","55405"] },
  { city: "Portland",      state: "OR", zips: ["97201","97202","97203","97204","97205"] },
  { city: "Las Vegas",     state: "NV", zips: ["89101","89102","89103","89104","89105"] },
  { city: "Detroit",       state: "MI", zips: ["48201","48202","48203","48204","48205"] },
  { city: "Baltimore",     state: "MD", zips: ["21201","21202","21203","21204","21205"] },
  { city: "Charlotte",     state: "NC", zips: ["28201","28202","28203","28204","28205"] },
  { city: "Philadelphia",  state: "PA", zips: ["19101","19102","19103","19104","19105"] },
  { city: "San Antonio",   state: "TX", zips: ["78201","78202","78203","78204","78205"] },
  { city: "Columbus",      state: "OH", zips: ["43201","43202","43203","43204","43205"] },
  { city: "Indianapolis",  state: "IN", zips: ["46201","46202","46203","46204","46205"] },
  { city: "Memphis",       state: "TN", zips: ["38101","38102","38103","38104","38105"] },
];

const ethnicities = [
  "Hispanic or Latino",
  "Not Hispanic or Latino",
  "Not Hispanic or Latino",
  "Not Hispanic or Latino",
  "Unknown / Not Reported",
];

const races = [
  "White",
  "White",
  "Black or African American",
  "Black or African American",
  "Asian",
  "Hispanic or Latino",
  "American Indian or Alaska Native",
  "Native Hawaiian or Other Pacific Islander",
  "Two or More Races",
  "Other / Not Reported",
];

const insuranceProviders = [
  { name: "Aetna Choice POS II",          planType: "Commercial POS" },
  { name: "UnitedHealthcare Choice Plus",  planType: "Commercial PPO" },
  { name: "BlueCross BlueShield PPO",      planType: "Commercial PPO" },
  { name: "Cigna Open Access Plus",        planType: "Commercial OAP" },
  { name: "Humana HMO Gold",               planType: "Commercial HMO" },
  { name: "Kaiser Permanente HMO",         planType: "Commercial HMO" },
  { name: "Molina Healthcare Medicaid",    planType: "Medicaid" },
  { name: "CareSource Medicaid",           planType: "Medicaid" },
  { name: "Medicare Part B Traditional",   planType: "Medicare FFS" },
  { name: "UnitedHealthcare Medicare Adv", planType: "Medicare Advantage" },
  { name: "Anthem BCBS EPO",               planType: "Commercial EPO" },
  { name: "Centene / Health Net HMO",      planType: "Commercial HMO" },
  { name: "Oscar Health PPO",              planType: "Commercial PPO" },
  { name: "Ambetter Marketplace Silver",   planType: "ACA Marketplace" },
  { name: "Tricare Prime",                 planType: "Military / TRICARE" },
];

const providers = [
  "Sarah Mitchell, MD","David Chen, MD","Jennifer Patel, MD","Robert Williams, MD",
  "Maria Garcia, DO","James Thompson, NP","Linda Rodriguez, MD","Michael Brown, MD",
  "Patricia Johnson, NP","Kevin Lee, MD","Amanda Wilson, DO","Christopher Davis, MD",
  "Stephanie Martinez, MD","Brian Taylor, MD","Rachel Anderson, NP",
];

const conditions = [
  // Metabolic / Endocrine
  { name: "Type 2 Diabetes Mellitus",             code: "E11.9",   prefix: "DIA", labKey: "a1c" },
  { name: "Type 1 Diabetes Mellitus",             code: "E10.9",   prefix: "T1D", labKey: "a1c" },
  { name: "Obesity, unspecified",                 code: "E66.9",   prefix: "OBS", labKey: "bmi" },
  { name: "Morbid Obesity",                       code: "E66.01",  prefix: "MOB", labKey: "bmi" },
  { name: "Hyperlipidemia, unspecified",          code: "E78.5",   prefix: "LIP", labKey: "lipid" },
  { name: "Hypothyroidism, unspecified",          code: "E03.9",   prefix: "HYP", labKey: "tsh" },
  { name: "Hyperthyroidism",                      code: "E05.90",  prefix: "HTH", labKey: "tsh" },
  { name: "Polycystic Ovary Syndrome",            code: "E28.2",   prefix: "PCS", labKey: "hormone" },
  { name: "Cushing Syndrome",                     code: "E24.9",   prefix: "CSH", labKey: "cortisol" },
  { name: "Metabolic Syndrome",                   code: "E88.81",  prefix: "MET", labKey: "lipid" },
  // Cardiovascular
  { name: "Essential Hypertension",               code: "I10",     prefix: "HTN", labKey: "bmp" },
  { name: "Coronary Artery Disease",              code: "I25.10",  prefix: "CAD", labKey: "troponin" },
  { name: "Heart Failure with Reduced EF",        code: "I50.20",  prefix: "HFR", labKey: "bnp" },
  { name: "Atrial Fibrillation",                  code: "I48.91",  prefix: "AFI", labKey: "inr" },
  { name: "Peripheral Artery Disease",            code: "I73.9",   prefix: "PAD", labKey: "lipid" },
  { name: "Dyslipidemia",                         code: "E78.00",  prefix: "DYS", labKey: "lipid" },
  { name: "Hypertensive Heart Disease",           code: "I11.9",   prefix: "HHD", labKey: "bmp" },
  // Renal
  { name: "Chronic Kidney Disease Stage 2",       code: "N18.2",   prefix: "CKD", labKey: "bmp" },
  { name: "Chronic Kidney Disease Stage 3a",      code: "N18.31",  prefix: "CK3", labKey: "bmp" },
  { name: "Chronic Kidney Disease Stage 4",       code: "N18.4",   prefix: "CK4", labKey: "bmp" },
  { name: "Nephrolithiasis (Kidney Stones)",      code: "N20.0",   prefix: "NEP", labKey: "bmp" },
  // Respiratory
  { name: "Asthma, unspecified",                  code: "J45.909", prefix: "AST", labKey: "pft" },
  { name: "COPD, unspecified",                    code: "J44.9",   prefix: "COP", labKey: "pft" },
  { name: "Obstructive Sleep Apnea",              code: "G47.33",  prefix: "OSA", labKey: "bmi" },
  { name: "Pulmonary Hypertension",               code: "I27.20",  prefix: "PHT", labKey: "bnp" },
  // Gastrointestinal
  { name: "Gastroesophageal Reflux Disease",      code: "K21.9",   prefix: "GER", labKey: "cbc" },
  { name: "Irritable Bowel Syndrome",             code: "K58.9",   prefix: "IBS", labKey: "cbc" },
  { name: "Crohn's Disease",                      code: "K50.90",  prefix: "CRN", labKey: "crp" },
  { name: "Ulcerative Colitis",                   code: "K51.90",  prefix: "UCO", labKey: "crp" },
  { name: "Non-alcoholic Fatty Liver Disease",    code: "K76.0",   prefix: "NAF", labKey: "lft" },
  // Musculoskeletal
  { name: "Osteoarthritis of Knee",               code: "M17.11",  prefix: "OAK", labKey: "crp" },
  { name: "Rheumatoid Arthritis",                 code: "M06.9",   prefix: "RHA", labKey: "crp" },
  { name: "Osteoporosis without Fracture",        code: "M81.0",   prefix: "OST", labKey: "calcium" },
  { name: "Fibromyalgia",                         code: "M79.3",   prefix: "FIB", labKey: "crp" },
  { name: "Systemic Lupus Erythematosus",         code: "M32.9",   prefix: "SLE", labKey: "crp" },
  // Neurological / Mental Health
  { name: "Migraine without Aura",               code: "G43.909", prefix: "MIG", labKey: "cbc" },
  { name: "Epilepsy, unspecified",                code: "G40.909", prefix: "EPI", labKey: "cbc" },
  { name: "Parkinson Disease",                    code: "G20",     prefix: "PKN", labKey: "cbc" },
  { name: "Multiple Sclerosis",                   code: "G35",     prefix: "MSC", labKey: "crp" },
  { name: "Major Depressive Disorder",            code: "F32.9",   prefix: "MDD", labKey: "tsh" },
  { name: "Generalized Anxiety Disorder",         code: "F41.1",   prefix: "GAD", labKey: "tsh" },
  { name: "Bipolar Disorder Type I",              code: "F31.9",   prefix: "BPD", labKey: "cbc" },
  { name: "ADHD, combined type",                  code: "F90.2",   prefix: "ADH", labKey: "cbc" },
  // Oncology
  { name: "Breast Cancer (Estrogen Receptor+)",   code: "C50.911", prefix: "BCA", labKey: "tumor" },
  { name: "Colorectal Cancer",                    code: "C18.9",   prefix: "CRC", labKey: "cea" },
  { name: "Prostate Cancer",                      code: "C61",     prefix: "PCA", labKey: "psa" },
  { name: "Lung Adenocarcinoma",                  code: "C34.10",  prefix: "LCA", labKey: "cbc" },
  { name: "Non-Hodgkin Lymphoma",                 code: "C85.90",  prefix: "NHL", labKey: "cbc" },
  // Infectious / Immune
  { name: "HIV Infection",                        code: "B20",     prefix: "HIV", labKey: "cd4" },
  { name: "Chronic Hepatitis C",                  code: "B18.2",   prefix: "HCV", labKey: "lft" },
  { name: "Recurrent UTI",                        code: "N39.0",   prefix: "UTI", labKey: "ua" },
  // Dermatological
  { name: "Psoriasis vulgaris",                   code: "L40.0",   prefix: "PSO", labKey: "crp" },
  { name: "Atopic Dermatitis (Eczema)",           code: "L20.9",   prefix: "EZM", labKey: "ige" },
];

const labTests = {
  a1c: {
    testName: "Hemoglobin A1C",
    loincCode: "4548-4",
    unit: "%",
    refRange: "4.0 - 5.6",
    value: () => (Math.random() * 4 + 5.5).toFixed(1),
    interpretation: (v) => parseFloat(v) > 6.5 ? "Elevated; consistent with diabetes" : parseFloat(v) > 5.7 ? "Borderline; prediabetes range" : "Within normal limits",
  },
  lipid: {
    testName: "Lipid Panel",
    loincCode: "57698-3",
    unit: "mg/dL",
    refRange: "LDL < 100",
    value: () => `LDL: ${randomInt(85,220)}  HDL: ${randomInt(30,75)}  TG: ${randomInt(100,350)}`,
    interpretation: (v) => "See individual components",
  },
  bmp: {
    testName: "Basic Metabolic Panel",
    loincCode: "51990-0",
    unit: "various",
    refRange: "See reference",
    value: () => `Creatinine: ${(Math.random()*2+0.6).toFixed(2)} mg/dL  BUN: ${randomInt(10,40)}  Na: ${randomInt(135,145)}  K: ${(Math.random()*1.5+3.5).toFixed(1)}`,
    interpretation: (v) => "Review individual values against reference ranges",
  },
  cbc: {
    testName: "Complete Blood Count",
    loincCode: "58410-2",
    unit: "various",
    refRange: "See reference",
    value: () => `WBC: ${(Math.random()*6+4).toFixed(1)} K/uL  Hgb: ${(Math.random()*4+10).toFixed(1)} g/dL  Plt: ${randomInt(150,400)} K/uL`,
    interpretation: (v) => "Values within expected range for chronic disease monitoring",
  },
  tsh: {
    testName: "Thyroid Stimulating Hormone (TSH)",
    loincCode: "3016-3",
    unit: "mIU/L",
    refRange: "0.4 - 4.0",
    value: () => (Math.random()*6+0.2).toFixed(2),
    interpretation: (v) => parseFloat(v) > 4.0 ? "Elevated; suggestive of hypothyroidism" : parseFloat(v) < 0.4 ? "Suppressed; suggestive of hyperthyroidism" : "Normal",
  },
  crp: {
    testName: "C-Reactive Protein (hsCRP)",
    loincCode: "30522-7",
    unit: "mg/L",
    refRange: "< 3.0",
    value: () => (Math.random()*15+0.5).toFixed(1),
    interpretation: (v) => parseFloat(v) > 10 ? "Markedly elevated; active inflammation" : parseFloat(v) > 3 ? "Elevated; increased cardiovascular risk" : "Normal",
  },
  bmi: {
    testName: "Body Mass Index",
    loincCode: "39156-5",
    unit: "kg/m²",
    refRange: "18.5 - 24.9",
    value: () => (Math.random()*20+22).toFixed(1),
    interpretation: (v) => parseFloat(v) >= 40 ? "Class III Obesity" : parseFloat(v) >= 35 ? "Class II Obesity" : parseFloat(v) >= 30 ? "Class I Obesity" : parseFloat(v) >= 25 ? "Overweight" : "Normal",
  },
  bnp: {
    testName: "B-type Natriuretic Peptide (BNP)",
    loincCode: "42637-9",
    unit: "pg/mL",
    refRange: "< 100",
    value: () => randomInt(40, 900),
    interpretation: (v) => parseInt(v) > 400 ? "Markedly elevated; heart failure likely" : parseInt(v) > 100 ? "Elevated; cardiac stress present" : "Normal",
  },
  inr: {
    testName: "INR / Prothrombin Time",
    loincCode: "6301-6",
    unit: "INR",
    refRange: "0.9 - 1.1 (therapeutic 2.0-3.0)",
    value: () => (Math.random()*2.5+0.9).toFixed(1),
    interpretation: (v) => parseFloat(v) > 3.0 ? "Supratherapeutic; risk of bleeding" : parseFloat(v) >= 2.0 ? "Therapeutic range for anticoagulation" : "Below therapeutic range",
  },
  troponin: {
    testName: "High-Sensitivity Troponin I",
    loincCode: "89579-7",
    unit: "ng/L",
    refRange: "< 26",
    value: () => randomInt(5, 120),
    interpretation: (v) => parseInt(v) > 52 ? "Elevated; myocardial injury suspected" : "Within reference range",
  },
  pft: {
    testName: "Spirometry FEV1/FVC Ratio",
    loincCode: "19926-5",
    unit: "%",
    refRange: "> 70",
    value: () => randomInt(40, 85),
    interpretation: (v) => parseInt(v) < 70 ? "Obstructive pattern; consistent with COPD/Asthma" : "Normal spirometry",
  },
  lft: {
    testName: "Liver Function Tests (ALT)",
    loincCode: "1742-6",
    unit: "U/L",
    refRange: "7 - 56",
    value: () => randomInt(20, 180),
    interpretation: (v) => parseInt(v) > 56 ? "Elevated ALT; hepatocellular injury" : "Normal",
  },
  calcium: {
    testName: "Serum Calcium",
    loincCode: "17861-6",
    unit: "mg/dL",
    refRange: "8.5 - 10.2",
    value: () => (Math.random()*3+7.8).toFixed(1),
    interpretation: (v) => parseFloat(v) > 10.2 ? "Hypercalcemia" : parseFloat(v) < 8.5 ? "Hypocalcemia" : "Normal",
  },
  hormone: {
    testName: "Total Testosterone / LH / FSH Panel",
    loincCode: "2986-8",
    unit: "ng/dL / mIU/mL",
    refRange: "Female: T < 70 ng/dL",
    value: () => `Testosterone: ${randomInt(20,90)} ng/dL  LH: ${(Math.random()*10+1).toFixed(1)}  FSH: ${(Math.random()*10+1).toFixed(1)}`,
    interpretation: (v) => "Consistent with hormonal dysregulation; correlate clinically",
  },
  cortisol: {
    testName: "Morning Serum Cortisol",
    loincCode: "2143-6",
    unit: "mcg/dL",
    refRange: "6 - 23",
    value: () => (Math.random()*25+4).toFixed(1),
    interpretation: (v) => parseFloat(v) > 23 ? "Elevated cortisol; adrenal excess suspected" : parseFloat(v) < 6 ? "Low cortisol; adrenal insufficiency possible" : "Normal",
  },
  psa: {
    testName: "Prostate-Specific Antigen (PSA)",
    loincCode: "2857-1",
    unit: "ng/mL",
    refRange: "< 4.0",
    value: () => (Math.random()*15+0.5).toFixed(2),
    interpretation: (v) => parseFloat(v) > 10 ? "Markedly elevated; urological evaluation required" : parseFloat(v) > 4 ? "Elevated; further workup indicated" : "Normal",
  },
  cea: {
    testName: "Carcinoembryonic Antigen (CEA)",
    loincCode: "2000-8",
    unit: "ng/mL",
    refRange: "< 3.0",
    value: () => (Math.random()*20+0.5).toFixed(1),
    interpretation: (v) => parseFloat(v) > 3 ? "Elevated CEA; tumor marker follow-up needed" : "Within normal limits",
  },
  tumor: {
    testName: "CA 27-29 (Breast Tumor Marker)",
    loincCode: "17842-6",
    unit: "U/mL",
    refRange: "< 38.0",
    value: () => (Math.random()*80+5).toFixed(1),
    interpretation: (v) => parseFloat(v) > 38 ? "Elevated; oncology correlation required" : "Normal",
  },
  cd4: {
    testName: "CD4 T-Cell Count",
    loincCode: "24467-3",
    unit: "cells/mm³",
    refRange: "500 - 1500",
    value: () => randomInt(180, 950),
    interpretation: (v) => parseInt(v) < 200 ? "Severe immunodeficiency" : parseInt(v) < 500 ? "Moderate immunodeficiency; monitor closely" : "Adequate immune function",
  },
  ua: {
    testName: "Urinalysis with Reflex Culture",
    loincCode: "5767-9",
    unit: "qualitative",
    refRange: "Negative",
    value: () => `Nitrites: ${Math.random()>0.5?"Positive":"Negative"}  Leukocyte Esterase: ${Math.random()>0.4?"Positive":"Negative"}  WBCs: ${randomInt(0,50)}/hpf`,
    interpretation: (v) => v.includes("Positive") ? "Findings suggest urinary tract infection" : "No significant findings",
  },
  ige: {
    testName: "Total Serum IgE",
    loincCode: "19113-0",
    unit: "IU/mL",
    refRange: "< 100",
    value: () => randomInt(20, 600),
    interpretation: (v) => parseInt(v) > 100 ? "Elevated IgE; atopic disease or allergic process" : "Normal",
  },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(list) {
  return list[randomInt(0, list.length - 1)];
}

function randomDate(startYear, endYear) {
  const year = randomInt(startYear, endYear);
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOfBirthFromAge(age) {
  const currentYear = new Date().getFullYear();
  const year = currentYear - age;
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickConditions(count) {
  const shuffled = [...conditions].sort(() => Math.random() - 0.5);
  const picked = [shuffled[0]];
  for (let i = 1; i < shuffled.length && picked.length < count; i++) {
    if (shuffled[i].code !== picked[0].code) picked.push(shuffled[i]);
  }
  return picked;
}

const TOTAL = 500;

for (let i = 1; i <= TOTAL; i += 1) {
  const firstName  = randomFrom(firstNames);
  const middleName = randomFrom(middleNames);
  const lastName   = randomFrom(lastNames);
  const age        = randomInt(22, 88);
  const gender     = Math.random() > 0.5 ? "Male" : "Female";
  const loc        = randomFrom(locationData);
  const zipcode    = randomFrom(loc.zips);
  const street     = `${randomInt(100, 9999)} ${randomFrom(streetNames)}`;
  const ethnicity  = randomFrom(ethnicities);
  const race       = randomFrom(races);
  const insurance  = randomFrom(insuranceProviders);
  const provider   = randomFrom(providers);
  const dob        = dateOfBirthFromAge(age);

  const conditionCount = Math.random() < 0.35 ? 3 : Math.random() < 0.6 ? 2 : 1;
  const pickedConditions = pickConditions(conditionCount);
  const primaryCondition = pickedConditions[0];

  const patientId = `${primaryCondition.prefix}${String(i).padStart(4, "0")}`;
  const memberId  = `SYN${String(randomInt(400000000, 499999999))}`;
  const groupNum  = `GQ-${randomInt(10000, 99999)}`;

  // Build lab section from primary condition's labKey
  const labKey  = primaryCondition.labKey;
  const lab     = labTests[labKey];
  const labVal  = String(lab.value());
  const labInterp = lab.interpretation(labVal);
  const collDate = randomDate(2024, 2026);
  const repDate  = collDate; // same day or next

  const doc = new PDFDocument({ size: "A4", margin: 54 });
  const fileName = `clinical-record-${String(i).padStart(4, "0")}.pdf`;
  const filePath = path.join(outputDir, fileName);
  doc.pipe(fs.createWriteStream(filePath));

  const diagLines = pickedConditions.map(
    (c, idx) =>
      `${idx + 1}. ${c.name} (ICD-10: ${c.code}) — Onset: ${randomDate(2010, 2024)}  Status: Active`
  );

  const lines = [
    "Synthetic Patient Sample - Clinical Trial Screening",
    "For demo and testing only. No real patient data.",
    "",
    `Patient ID: ${patientId}`,
    `Patient First Name: ${firstName}`,
    `Patient Middle Name: ${middleName}`,
    `Patient Last Name: ${lastName}`,
    `Date of Birth: ${dob}`,
    `Age: ${age}`,
    `Gender: ${gender}`,
    `Race: ${race}`,
    `Ethnicity: ${ethnicity}`,
    `Home Address: ${street}, ${loc.city}, ${loc.state} ${zipcode}`,
    "",
    `Health Insurance Provider: ${insurance.name}`,
    `Member ID: ${memberId}`,
    `Group Number: ${groupNum}`,
    `Plan Type: ${insurance.planType}`,
    "",
    "Clinical Diagnoses:",
    ...diagLines,
    "",
    "Laboratory Results:",
    `Test Name: ${lab.testName}`,
    `LOINC Code: ${lab.loincCode}`,
    `Result Value: ${labVal} ${lab.unit}`,
    `Reference Range: ${lab.refRange} ${lab.unit}`,
    `Interpretation: ${labInterp}`,
    `Collection Date: ${collDate}`,
    `Reported Date: ${repDate}`,
    `Ordering Provider: ${provider}`,
    "",
    `Clinical Note: Patient presents for follow-up management of ${primaryCondition.name.toLowerCase()}.`,
    `Potential Use Case: ${primaryCondition.name} clinical trial pre-screening`,
  ];

  doc.font("Courier").fontSize(11).text(lines.join("\n"), { align: "left", lineGap: 3 });
  doc.end();

  if (i % 50 === 0) {
    console.log(`  Generated ${i}/${TOTAL} PDFs...`);
  }
}

console.log(`\nDone — ${TOTAL} PDFs written to sample-data/pdf-examples/`);

