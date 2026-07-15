import { ParseResult } from "@/types/medical";

function buildTemporalClause(parsed: ParseResult) {
  const { diagnosedWithinYears, diagnosedWithinMonths } = parsed.filters;

  if (diagnosedWithinYears) {
    return `diagnosis_date >= DATEADD(year, -${diagnosedWithinYears}, GETDATE())`;
  }

  if (diagnosedWithinMonths) {
    return `diagnosis_date >= DATEADD(month, -${diagnosedWithinMonths}, GETDATE())`;
  }

  return undefined;
}

function buildLabValueClauses(labValues?: Map<string, { operator: string; value: number }>): string[] {
  if (!labValues || labValues.size === 0) return [];
  
  const clauses: string[] = [];
  
  for (const [labName, { operator, value }] of labValues.entries()) {
    // Map lab names to potential column names or use as-is
    const columnName = `lab_${labName.toLowerCase()}`;
    clauses.push(`${columnName} ${operator} ${value}`);
  }
  
  return clauses;
}

function buildExclusionClauses(exclusions?: string[]): string[] {
  if (!exclusions || exclusions.length === 0) return [];
  
  const clauses: string[] = [];
  
  for (const exclusion of exclusions) {
    if (exclusion === "former_smoker") {
      clauses.push(`smoking_status != 'former'`);
    } else if (exclusion === "current_smoker") {
      clauses.push(`smoking_status != 'current'`);
    } else if (exclusion === "diabetes") {
      clauses.push(`diagnosis_code NOT IN ('E10', 'E11', 'E13', 'E14')`);
    }
  }
  
  return clauses;
}

function buildInsuranceFilterClauses(insuranceStatus?: string[]): string[] {
  if (!insuranceStatus || insuranceStatus.length === 0) return [];
  
  const clauses: string[] = [];
  const insuranceValues = insuranceStatus.map((s) => `'${s}'`).join(",");
  clauses.push(`insurance_status IN (${insuranceValues})`);
  
  return clauses;
}

function buildMedicationExclusionClauses(medicationExclusions?: string[]): string[] {
  if (!medicationExclusions || medicationExclusions.length === 0) return [];
  
  const clauses: string[] = [];
  
  for (const medication of medicationExclusions) {
    if (medication === "insulin") {
      clauses.push(`medication_code NOT IN ('insulin', 'lispro', 'aspart', 'glargine', 'detemir')`);
    } else if (medication === "statin") {
      clauses.push(`medication_code NOT IN ('atorvastatin', 'simvastatin', 'pravastatin', 'rosuvastatin')`);
    } else if (medication === "ace_inhibitor") {
      clauses.push(`medication_code NOT IN ('lisinopril', 'enalapril', 'ramipril', 'perindopril')`);
    } else if (medication === "beta_blocker") {
      clauses.push(`medication_code NOT IN ('metoprolol', 'atenolol', 'bisoprolol', 'carvedilol')`);
    } else if (medication === "anticoagulant") {
      clauses.push(`medication_code NOT IN ('warfarin', 'apixaban', 'rivaroxaban', 'dabigatran')`);
    }
  }
  
  return clauses;
}

function buildSelectClause(selectedFields?: string[]): string {
  const baseFields = [
    "patient_id",
    "full_name",
    "age",
    "gender",
    "date_of_birth",
    "city",
    "state",
    "zipcode",
    "diagnosis_code",
    "symptom_code",
    "diagnosis_date",
  ];
  
  if (!selectedFields || selectedFields.length === 0) {
    return baseFields.join(",\n  ");
  }
  
  // Add requested fields to base fields
  const allFields = new Set(baseFields);
  
  for (const field of selectedFields) {
    if (field === "medications") {
      allFields.add("medications");
      allFields.add("medication_codes");
    } else if (field === "diagnosis_codes") {
      // Already in base
    } else if (field === "procedures") {
      allFields.add("procedures");
      allFields.add("procedure_codes");
    } else if (field === "lab_results") {
      allFields.add("lab_results");
      allFields.add("lab_values");
    } else if (field === "race") {
      allFields.add("race");
    } else if (field === "ethnicity") {
      allFields.add("ethnicity");
    } else if (field === "date_of_birth") {
      // Already in base
    } else if (field === "contact_info") {
      allFields.add("phone");
      allFields.add("email");
      allFields.add("address");
    }
  }
  
  return Array.from(allFields).join(",\n  ");
}

export function generateSqlFromParsedQuery(parsed: ParseResult) {
  const whereClauses: string[] = [];
  const diagnosisCodes = parsed.concepts
    .filter((c) => c.category === "disease")
    .map((c) => c.code);

  const symptomCodes = parsed.concepts
    .filter((c) => c.category === "symptom")
    .map((c) => c.code);

  // Add direct ICD codes
  const allDiagnosisCodes = [
    ...diagnosisCodes,
    ...(parsed.filters.directIcdCodes ?? []),
  ];

  // If multiple required conditions, each must be present (AND logic)
  if (parsed.filters.requiredConditionCodes && parsed.filters.requiredConditionCodes.length > 1) {
    for (const code of parsed.filters.requiredConditionCodes) {
      whereClauses.push(`diagnosis_code = '${code}'`);
    }
  } else if (allDiagnosisCodes.length > 0) {
    whereClauses.push(`diagnosis_code IN ('${allDiagnosisCodes.join("','")}')`);
  }

  if (symptomCodes.length > 0) {
    whereClauses.push(`symptom_code IN ('${symptomCodes.join("','")}')`);
  }

  if (parsed.filters.ageMin) {
    whereClauses.push(`age > ${parsed.filters.ageMin}`);
  }

  if (parsed.filters.ageMax) {
    whereClauses.push(`age < ${parsed.filters.ageMax}`);
  }

  if (parsed.filters.gender) {
    whereClauses.push(`gender = '${parsed.filters.gender}'`);
  }

  if (parsed.filters.ethnicity) {
    whereClauses.push(
      `LOWER(ethnicity) LIKE LOWER('%${parsed.filters.ethnicity.replace(/'/g, "''")}%')`
    );
  }

  if (parsed.filters.race) {
    whereClauses.push(
      `LOWER(race) LIKE LOWER('%${parsed.filters.race.replace(/'/g, "''")}%')`
    );
  }

  if (parsed.filters.city) {
    whereClauses.push(`LOWER(city) = LOWER('${parsed.filters.city.replace(/'/g, "''")}')`);
  }

  if (parsed.filters.state) {
    whereClauses.push(`LOWER(state) = LOWER('${parsed.filters.state.replace(/'/g, "''")}')`);
  }

  if (parsed.filters.zipcode && !parsed.filters.zipcodeRadiusMiles) {
    whereClauses.push(`zipcode = '${parsed.filters.zipcode.replace(/'/g, "''")}'`);
  }

  if (parsed.filters.zipcode && parsed.filters.zipcodeRadiusMiles) {
    whereClauses.push(
      `zipcode_radius_miles(zipcode, '${parsed.filters.zipcode.replace(/'/g, "''")}') <= ${parsed.filters.zipcodeRadiusMiles}`
    );
  }

  const temporalClause = buildTemporalClause(parsed);
  if (temporalClause) {
    whereClauses.push(temporalClause);
  }
  
  // Add lab value clauses
  const labClauses = buildLabValueClauses(parsed.filters.labValues);
  whereClauses.push(...labClauses);
  
  // Add exclusion clauses
  const exclusionClauses = buildExclusionClauses(parsed.filters.exclusions);
  whereClauses.push(...exclusionClauses);
  
  // Add insurance filter clauses
  const insuranceClauses = buildInsuranceFilterClauses(parsed.filters.insuranceStatus);
  whereClauses.push(...insuranceClauses);
  
  // Add medication exclusion clauses
  const medicationExclusionClauses = buildMedicationExclusionClauses(parsed.filters.medicationExclusions);
  whereClauses.push(...medicationExclusionClauses);

  const whereBlock =
    whereClauses.length > 0
      ? `WHERE\n  ${whereClauses.join("\n  AND ")}`
      : "-- No filters extracted";

  const selectClause = buildSelectClause(parsed.filters.selectedFields);

  return `SELECT\n  ${selectClause}\nFROM patients\n${whereBlock}\nORDER BY diagnosis_date DESC;`;
}
