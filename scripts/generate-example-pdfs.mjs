import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const outputDir = path.resolve("sample-data", "pdf-examples");
fs.mkdirSync(outputDir, { recursive: true });

const firstNames = [
  "Ava", "Liam", "Mia", "Noah", "Olivia", "Ethan", "Sophia", "Lucas", "Isla", "Mason",
  "Amelia", "Elijah", "Harper", "James", "Charlotte", "Benjamin", "Evelyn", "Logan", "Ella", "Henry"
];

const lastNames = [
  "Turner", "Brooks", "Morris", "Diaz", "Reed", "Coleman", "Foster", "Kelly", "Hayes", "Bennett",
  "Sanders", "Price", "Patel", "Sharma", "Nguyen", "Rogers", "Campbell", "Parker", "Edwards", "Howard"
];

const conditions = [
  { name: "Type 2 Diabetes Mellitus", code: "E11.9" },
  { name: "Hyperlipidemia", code: "E78.5" },
  { name: "Essential Hypertension", code: "I10" },
  { name: "Chronic Kidney Disease Stage 2", code: "N18.2" },
  { name: "Hypothyroidism", code: "E03.9" },
  { name: "Obesity", code: "E66.9" },
  { name: "Coronary Artery Disease", code: "I25.10" },
  { name: "Asthma", code: "J45.909" },
  { name: "Gastroesophageal Reflux Disease", code: "K21.9" },
  { name: "Osteoarthritis", code: "M19.90" }
];

const medications = [
  { name: "Metformin", strength: "1000mg BID", rxnorm: "860974" },
  { name: "Atorvastatin", strength: "40mg QD", rxnorm: "83367" },
  { name: "Lisinopril", strength: "20mg QD", rxnorm: "316047" },
  { name: "Amlodipine", strength: "5mg QD", rxnorm: "197361" },
  { name: "Levothyroxine", strength: "75mcg QD", rxnorm: "966247" },
  { name: "Omeprazole", strength: "20mg QD", rxnorm: "7646" },
  { name: "Albuterol", strength: "90mcg PRN", rxnorm: "435" },
  { name: "Aspirin", strength: "81mg QD", rxnorm: "1191" }
];

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

for (let i = 1; i <= 10; i += 1) {
  const firstName = randomFrom(firstNames);
  const lastName = randomFrom(lastNames);
  const fullName = `${firstName} ${lastName}`;
  const age = randomInt(38, 84);
  const gender = Math.random() > 0.5 ? "Male" : "Female";

  const diagnosis1 = randomFrom(conditions);
  let diagnosis2 = randomFrom(conditions);
  while (diagnosis2.code === diagnosis1.code) {
    diagnosis2 = randomFrom(conditions);
  }

  const med1 = randomFrom(medications);
  let med2 = randomFrom(medications);
  while (med2.rxnorm === med1.rxnorm) {
    med2 = randomFrom(medications);
  }

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const fileName = `clinical-record-${String(i).padStart(2, "0")}.pdf`;
  const filePath = path.join(outputDir, fileName);
  doc.pipe(fs.createWriteStream(filePath));

  const lines = [
    "PATIENT CLINICAL RECORD - CONFIDENTIAL",
    "--------------------------------------",
    `Patient: ${fullName}`,
    `Age: ${age}`,
    `Gender: ${gender}`,
    "",
    "Chief Complaint: Follow-up for chronic conditions.",
    "",
    "Diagnosis:",
    `1. ${diagnosis1.name} (ICD-10: ${diagnosis1.code}) - Diagnosed ${randomDate(2013, 2021)}. Status: Active.`,
    `2. ${diagnosis2.name} (ICD-10: ${diagnosis2.code}) - Diagnosed ${randomDate(2014, 2023)}. Status: Active.`,
    "",
    "Current Medications:",
    `- ${med1.name} ${med1.strength} (RxNorm: ${med1.rxnorm}) - Active: Yes`,
    `- ${med2.name} ${med2.strength} (RxNorm: ${med2.rxnorm}) - Active: Yes`,
    "",
    `Lab Results (Date: ${randomDate(2023, 2026)}):`,
    `- HbA1c: ${(Math.random() * 3 + 5.8).toFixed(1)} %`,
    `- LDL Cholesterol: ${randomInt(90, 180)} mg/dL`,
    `- Triglycerides: ${randomInt(110, 300)} mg/dL`,
    `- Blood Glucose: ${randomInt(95, 210)} mg/dL`
  ];

  doc.font("Courier").fontSize(12).text(lines.join("\n"), {
    align: "left",
    lineGap: 4
  });

  doc.end();
}

console.log("Generated 10 example PDFs in sample-data/pdf-examples");
