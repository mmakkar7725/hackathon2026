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

export function generateSqlFromParsedQuery(parsed: ParseResult) {
  const whereClauses: string[] = [];
  const diagnosisCodes = parsed.concepts
    .filter((c) => c.category === "disease")
    .map((c) => c.code);

  const symptomCodes = parsed.concepts
    .filter((c) => c.category === "symptom")
    .map((c) => c.code);

  if (diagnosisCodes.length > 0) {
    whereClauses.push(`diagnosis_code IN ('${diagnosisCodes.join("','")}')`);
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

  const whereBlock =
    whereClauses.length > 0
      ? `WHERE\n  ${whereClauses.join("\n  AND ")}`
      : "-- No filters extracted";

  return `SELECT\n  patient_id,\n  full_name,\n  age,\n  gender,\n  date_of_birth,\n  city,\n  state,\n  zipcode,\n  diagnosis_code,\n  symptom_code,\n  diagnosis_date\nFROM patients\n${whereBlock}\nORDER BY diagnosis_date DESC;`;
}
