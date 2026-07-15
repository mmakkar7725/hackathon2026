# MedQuery AI - Hackathon Clinical Trial Queries

## Overview
These eye-catching clinical trial queries demonstrate MedQuery AI's advanced NLP capabilities:
- **Multi-condition filtering** (AND logic for required conditions)
- **Lab value ranges** (LDL > 160, A1C > 8.0, etc.)
- **Insurance-based cohorts** (Medicare, Medicaid, Commercial)
- **Medication exclusions** (NOT on insulin, NOT on statins)
- **Demographic segmentation** (age, gender, race/ethnicity, geography)
- **Complex field selection** (medications, procedures, lab results)

---

## Query Set 1: Cardiovascular Disease Management Trial

### Query 1.1: "Heart Failure Optimization Study" 🔴 **HIGH IMPACT**
```
Find female Medicare patients age 50-75 in Texas with BOTH Heart Failure with Reduced EF 
AND Atrial Fibrillation who have recent BNP > 400 pg/mL, NOT on anticoagulation therapy. 
Show their current medications, lab results, and race/ethnicity.
```
**Why It Wins:**
- Targets high-risk population (HF + AFib requires aggressive management)
- Multi-condition AND logic (both required)
- Insurance-specific (Medicare typically older, more complex cases)
- Lab value threshold (BNP indicates heart function)
- Medication exclusion (identifies untreated patients)
- Real clinical trial use case

**Expected SQL:**
```sql
SELECT p.*, m.medications, l.lab_results
FROM patients p
WHERE p.age >= 50 AND p.age <= 75 
  AND p.gender = 'Female'
  AND p.insurance_status = 'Medicare'
  AND p.state = 'TX'
  AND p.diagnosis_code = 'I50.20'
  AND p.diagnosis_code = 'I48.91'
  AND l.bnp_value > 400
  AND p.medication_code NOT IN ('warfarin', 'apixaban', 'rivaroxaban', 'dabigatran')
```

### Query 1.2: "Hypertension + Diabetes Complication Prevention" 
```
Show male Hispanic patients age 40-65 with BOTH Type 2 Diabetes AND Essential Hypertension 
who have recent Hemoglobin A1C > 8.0% AND LDL > 160 mg/dL, excluding those currently on 
insulin or high-intensity statins. Include diagnoses, current medications, and recent lab work.
```
**Why It Wins:**
- Addresses prevalent comorbidity pattern (DM + HTN = 70% of diabetes patients)
- Demographic specificity (Hispanic population health equity focus)
- Dual biomarker thresholds (A1C + LDL indicate poor control)
- Medication logic (insulin/statin non-use = intervention candidates)

---

## Query Set 2: Kidney Disease Progression Studies

### Query 2.1: "CKD Stage 3+ Cohort Builder" 🔵 **TECHNICAL COMPLEXITY**
```
Identify patients age 55-80 from California, Colorado, and Texas with Chronic Kidney Disease 
Stage 3 or Stage 4 (N18.31 OR N18.4) AND Diabetes who have recent serum Creatinine > 1.8 mg/dL, 
eGFR 15-44, and are NOT on ACE inhibitors or ARB therapy. Include race, insurance type, and 
complete medication list.
```
**Why It Wins:**
- Geographic distribution (multi-state trial recruitment)
- ICD-10 specificity (stages 3a vs 4 have different interventions)
- Multi-biomarker correlation (Creatinine + eGFR critical for CKD trials)
- Medication class exclusion (ACE/ARB non-use = eligible population)
- Insurance diversity matters (affects treatment access/adherence)

### Query 2.2: "Diabetic Nephropathy Risk Stratification"
```
Find all Medicare AND Medicaid patients age 45-70 with BOTH Diabetes AND CKD Stage 2-3a 
who have BMP showing elevated BUN (> 25 mg/dL) and Creatinine 1.2-2.0, but are NOT currently 
on SGLT2 inhibitors. Include age, gender, ethnicity, contact information, and full medication list.
```
**Why It Wins:**
- Insurance diversity (dual eligibility = complex comorbidities)
- Early intervention window (Stage 2-3 before progression)
- BMP value ranges (specific numeric thresholds)
- Novel drug class exclusion (SGLT2 inhibitors emerging therapy)

---

## Query Set 3: Respiratory Disease Management

### Query 3.1: "COPD Exacerbation Prevention Trial"
```
Show female patients age 60-80 with COPD who also have Asthma, living in urban areas 
(Seattle, Denver, Phoenix, Chicago) with recent Spirometry FEV1/FVC < 60% AND C-Reactive 
Protein > 5 mg/L indicating active inflammation. Exclude current smokers and those NOT on 
ICS/LABA combination therapy. Include medications, procedures, and recent lab results.
```
**Why It Wins:**
- Comorbidity complexity (COPD + Asthma overlap syndrome)
- Geographic targeting (air quality as confounder)
- Inflammatory biomarker (CRP = disease activity proxy)
- Smoking status exclusion (critical for respiratory trials)
- Medication regimen specificity (ICS/LABA = standard care)

### Query 3.2: "OSA-Resistant Hypertension Study"
```
Find male patients age 50-75 with BOTH Obstructive Sleep Apnea AND Hypertension with BMI ≥ 32 
kg/m² who have recent BP readings ≥ 160/100 despite being on ≥ 3 antihypertensive medications. 
Insurance: Commercial PPO or Medicare Advantage. Show race, ethnicity, medications, and recent 
vitals.
```
**Why It Wins:**
- Bidirectional relationship (OSA worsens HTN, HTN worsens OSA)
- BMI threshold (obesity = pathogenic link)
- Medication count criteria (resistant HTN definition)
- Insurance impact on CPAP access
- Real clinical challenge

---

## Query Set 4: Oncology & Cancer Screening

### Query 4.1: "Triple-Positive Breast Cancer Cohort"
```
Identify female patients age 40-65 with ER+ Breast Cancer (C50.911) who also have Obesity 
AND Type 2 Diabetes with recent HbA1c > 7.5% and elevated inflammatory markers (CRP > 8 mg/L). 
Exclude those on insulin therapy. Show medications, prior procedures, lab history.
```
**Why It Wins:**
- Oncology-metabolic intersection (obesity + DM = worse outcomes)
- Hormone-dependent cancer subtype specification
- Inflammatory link (metabolic syndrome → cancer progression)
- Treatment decision support (insulin = additional complexity)

### Query 4.2: "Colorectal Cancer Surveillance Program"
```
Show all patients age 50-75 with history of Colorectal Cancer (C18.9) from any insurance 
type who have abnormal recent CEA levels (> 3.0 ng/mL) AND either rising CEA trend OR 
concurrent Atrial Fibrillation. Include all medications, procedures, and recent imaging results.
```
**Why It Wins:**
- Age group (screening/surveillance age)
- Biomarker trending (CEA trajectory matters)
- Comorbidity pattern (AFib common in cancer survivors)
- Multi-cancer risk (cancer + stroke risk)

---

## Query Set 5: Rare Disease & Complex Polycomorbidity

### Query 5.1: "Systemic Lupus + Nephritis Complex" 🟣 **RARE DISEASE**
```
Find female patients age 18-55 with Systemic Lupus Erythematosus (M32.9) AND Chronic Kidney 
Disease Stage 3-4 who have recent elevated creatinine (> 1.5), proteinuria on urinalysis, 
AND active lupus markers (elevated CRP > 10 mg/L and positive autoimmune serology). 
Exclude those on high-dose corticosteroids (prednisone equiv > 20mg). Show race, ethnicity, 
medications, immunosuppressants.
```
**Why It Wins:**
- Rare disease focus (academic medical centers, specialized trial sites)
- Autoimmune complexity (multiple biomarker criteria)
- Medication intensity tracking (steroid dose matters)
- Demographics (predominantly young women)
- Real clinical challenge for AI parsing

### Query 5.2: "HIV + Cardiovascular Risk Reduction"
```
Find all patients age 35-65 with HIV infection (B20) who ALSO have Atrial Fibrillation OR 
Coronary Artery Disease and have CD4 count 200-500 cells/mm³ indicating moderate 
immunosuppression. Insurance: Medicare, Medicaid, or TRICARE. Show medications (especially 
antiretrovirals), cardiovascular meds, and lab trends.
```
**Why It Wins:**
- Vulnerable population (HIV + cardiovascular = emerging risk)
- Immunologic threshold (CD4 level affects drug choices)
- Medication complexity (antiretrovirals + cardiac meds interactions)
- Insurance diversity (TRICARE for veterans)
- Growing clinical need

---

## Query Set 6: Metabolic Syndrome & Prevention

### Query 6.1: "Metabolic Syndrome Pre-Intervention Cohort"
```
Identify patients age 30-60 with Metabolic Syndrome (E88.81) from Urban Texas (Dallas, 
Houston, Austin, San Antonio) who have BOTH Obesity AND Hyperlipidemia with recent BMI ≥ 32, 
Triglycerides > 200 mg/dL, AND HDL < 40 mg/dL, NOT yet on statin therapy. Show race, 
ethnicity, medications, and lifestyle factors. Exclude diabetics (separate intervention).
```
**Why It Wins:**
- Prevention focus (pre-disease intervention)
- Geographic pattern (Texas obesity rates)
- Metabolic parameter combination (lipid triad = metabolic syndrome)
- Treatment naïve (statin non-use = intervention eligible)
- Healthcare equity (diverse city population)

### Query 6.2: "Polycystic Ovary Syndrome Metabolic Intervention"
```
Show female patients age 18-45 with Polycystic Ovary Syndrome (E28.2) who have elevated 
testosterone levels (TT > 60 ng/dL or free T > 3 pg/mL) AND Insulin Resistance markers 
(fasting insulin > 12 or recent diabetes screening positive). Insurance: Commercial or 
Marketplace. Include fertility history, medications, and recent endocrine labs.
```
**Why It Wins:**
- Women's health focus (PCOS = 10-15% of reproductive-age women)
- Endocrine specificity (hormone levels > thresholds)
- Insulin resistance markers (insulin > 12 = early dysfunction)
- Insurance type matters (fertility benefits)
- Emerging therapeutic interventions

---

## Query Set 7: Geriatric & Complex Care

### Query 7.1: "Frailty & Polypharmacy Deprescribing Trial"
```
Find patients age 75-95 from any state with Medicare coverage who have BOTH Chronic Kidney 
Disease Stage 4 (N18.4) AND Cognitive/Neurologic condition (Dementia OR Parkinson Disease OR 
Epilepsy) who are on ≥ 10 chronic medications AND have fallen within past year (documented in 
providers' notes). Show all medications, recent vitals, and fall risk assessment.
```
**Why It Wins:**
- Geriatric complexity (multiple chronic diseases)
- Medication burden (polypharmacy = deprescribing opportunity)
- Fall risk (major geriatric adverse event)
- Cognitive impairment (impacts medication adherence)
- CKD Stage 4 (affects drug metabolism)

### Query 7.2: "End-of-Life Palliative Care Transition"
```
Identify patients age 70+ with any advanced cancer (stage 3+ lung, breast, colorectal, 
prostate) OR advanced heart failure (NYHA Stage 3-4 with recent BNP > 600) who are being 
seen at frequency > 4x per month indicating high utilization. Insurance: Medicare. 
Include oncology/cardiology procedures, symptom medications, and recent ED visits.
```
**Why It Wins:**
- End-of-life care (growing clinical need)
- Cancer + cardiac trajectory (two biggest killers)
- Utilization pattern (healthcare intensity)
- Palliative transition opportunity
- Real-world outcomes focus

---

## Query Set 8: Health Equity & Underserved Populations

### Query 8.1: "Health Equity: Diabetic Complications in Underinsured Hispanic Population" 🟡 **SOCIAL DETERMINANTS**
```
Show female Hispanic patients age 35-65 from South Texas (San Antonio, Corpus Christi, 
Brownsville area) with Type 2 Diabetes and Medicaid insurance who have poor glycemic control 
(A1C > 9.0%) AND recent complications (either Chronic Kidney Disease ANY stage, OR Peripheral 
Neuropathy, OR Diabetic Retinopathy). Exclude those with complex medication regimens 
suggesting recent intensification. Include income level if available, transportation barriers, 
medication access.
```
**Why It Wins:**
- Health equity focus (Hispanic population, Medicaid, rural South Texas)
- Social determinants lens (underserved population)
- Complication clustering (indicates care gaps)
- Poor control (A1C > 9.0% = engagement opportunity)
- Recent intensification exclusion (finds neglected patients)
- Hackathon appeal (addresses real health disparities)

### Query 8.2: "Opioid Use Disorder + Chronic Pain Comorbidity"
```
Find all patients age 20-60 with diagnosed Opioid Use Disorder who also have Chronic Pain 
conditions (Chronic Low Back Pain, Fibromyalgia, Rheumatoid Arthritis) AND are on multiple 
opioid prescriptions (morphine equiv > 50 mg/day) from multiple providers within past 3 months. 
Insurance: Medicaid, TRICARE, or Uninsured. Show medications, pharmacy fills, pain management 
procedures, and mental health diagnoses.
```
**Why It Wins:**
- Public health crisis (opioid epidemic)
- Behavioral health link (substance use disorder)
- Drug safety (multiple providers = duplication risk)
- Vulnerable insurance (Medicaid + TRICARE)
- Intervention opportunity (medication-assisted treatment)

---

## Query Set 9: Emerging Biomarker-Driven Precision Medicine

### Query 9.1: "Genetic Cardiomyopathy Risk Stratification"
```
Find patients age 18-65 with any diagnosis suggestive of cardiomyopathy (Dilated or 
Hypertrophic Cardiomyopathy, Heart Failure with reduced EF, Atrial Fibrillation with 
structural disease) who have recent BNP > 200 AND troponin > 26 ng/L (elevation suggestive 
of recent myocardial injury) AND have NO documented genetic testing yet. Show age, gender, 
family history if available, recent echocardiography results, medications.
```
**Why It Wins:**
- Precision medicine angle (genetic testing opportunity)
- Biomarker combination (BNP + troponin = myocardial stress)
- Unmet need (genetic testing gap)
- Family screening implication
- Emerging clinical practice

### Query 9.2: "Pharmacogenomic CYP2C9 Warfarin Sensitivity Cohort"
```
Identify patients age 50+ with Atrial Fibrillation (I48.91) who are on warfarin therapy 
AND have had INR instability (fluctuations between subtherapeutic < 1.8 and supratherapeutic > 3.5 
in past 3 months) AND lack documented CYP2C9 pharmacogenomic testing. Show current warfarin dose, 
INR trend, comorbidities, concurrent medications, and bleeding/clotting events.
```
**Why It Wins:**
- Pharmacogenomics application (CYP2C9 variant → warfarin sensitivity)
- Real clinical problem (INR instability → stroke/bleed risk)
- Testing gap (genetic stratification underutilized)
- Actionable intervention (dose adjustment or DOAC switch)

---

## Implementation Notes for Demo

### Key Features Showcased:
1. ✅ **NLP Extraction Power**: Complex multi-part queries → structured SQL
2. ✅ **Medical Code Integration**: ICD-10, SNOMED-CT, LOINC in natural language
3. ✅ **Multi-Filter Logic**: Age, gender, location, insurance, diagnoses, labs, medications
4. ✅ **Biomarker Reasoning**: Lab value ranges, trending, combination interpretation
5. ✅ **Healthcare Domain Specificity**: Clinical trial inclusion/exclusion criteria
6. ✅ **Social Determinants**: Insurance type, geography, health equity focus
7. ✅ **Real Use Cases**: Based on 500 synthetic but realistic patient records

### Hackathon Presentation Strategy:
- **Start with Query 1.1** (Heart Failure) - immediate clinical relevance
- **Transition to Query 5.1** (SLE + Nephritis) - showcase NLP complexity
- **Finish with Query 8.1** (Health Equity) - emotional impact + real-world value
- **Show generated SQL** - transparency builds judge confidence
- **Display extracted filters** - demonstrate systematic parsing
- **Highlight medical coding** - ICD-10/SNOMED/LOINC unification

### Expected Results from NEW SAMPLE Data:
- **Query 1.1**: ~15-25 matches (female Medicare, age 50-75, TX, HF+AFib, high BNP, no anticoagulation)
- **Query 8.1**: ~40-60 matches (Hispanic female, South TX, A1C > 9, Medicaid, DM complications)
- **Query 9.1**: ~20-30 matches (cardiomyopathy features, elevated biomarkers, no genetic testing)

---

## Testing Checklist for MedQuery Dev Team:

- [ ] Copy all 9 query sets into MedQuery demo interface
- [ ] Verify each query correctly extracts to structured SQL
- [ ] Validate insurance_status filters are working
- [ ] Test medication exclusion logic (NOT IN clauses)
- [ ] Confirm lab value range extraction (>, <, >=, <=)
- [ ] Check multi-condition AND logic (not OR)
- [ ] Verify geographic filtering (cities/states)
- [ ] Validate demographic segmentation (age, gender, race/ethnicity)
- [ ] Test complex combinations work without errors
- [ ] Run each query against NEW SAMPLE data and report patient counts

---

**Generated for MedQuery AI Hackathon 2026**
*Demonstrating AI-powered clinical trial patient identification & cohort discovery*
