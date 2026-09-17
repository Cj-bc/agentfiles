#!/usr/bin/env node

import fs from "node:fs";

const [reportPath] = process.argv.slice(2);
if (!reportPath) {
  console.error("Usage: validate-audit-json.mjs <report.json>");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Cannot parse ${reportPath}: ${error.message}`);
  process.exit(1);
}

const errors = [];
const statuses = ["valid", "corrupted", "disabled", "inconclusive"];
const genericType = "test_case_validity_audit";
const legacyType = "unity_test_case_validity_audit";
const isLegacy = report.report_type === legacyType;

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

requireValue(report.schema_version === "1.0", 'schema_version must be "1.0"');
requireValue(report.report_type === genericType || isLegacy,
  `report_type must be "${genericType}" (legacy "${legacyType}" is also accepted)`);
requireValue(report.audit && typeof report.audit === "object", "audit must be an object");
requireValue(report.summary && typeof report.summary === "object", "summary must be an object");
requireValue(Array.isArray(report.findings), "findings must be an array");
requireValue(Array.isArray(report.test_suites), "test_suites must be an array");
requireValue(Array.isArray(report.source_files_without_test_cases),
  "source_files_without_test_cases must be an array");

if (!isLegacy && report.audit) {
  requireValue(typeof report.audit.base_revision === "string" && report.audit.base_revision.length > 0,
    "audit.base_revision must be a non-empty string");
  requireValue(typeof report.audit.profile === "string" && report.audit.profile.length > 0,
    "audit.profile must be a non-empty string");
  requireValue(Array.isArray(report.audit.languages), "audit.languages must be an array");
  requireValue(Array.isArray(report.audit.frameworks), "audit.frameworks must be an array");
  requireValue(Array.isArray(report.audit.scope) && report.audit.scope.length > 0,
    "audit.scope must be a non-empty array");
  requireValue(typeof report.audit.tests_executed === "boolean",
    "audit.tests_executed must be boolean");
}

let methodCount = 0;
let expandedCount = 0;
const statusCounts = Object.fromEntries(statuses.map(status => [status, 0]));
const seenFiles = new Set();

for (const [suiteIndex, suite] of (report.test_suites ?? []).entries()) {
  requireValue(typeof suite.file === "string" && suite.file.length > 0,
    `test_suites[${suiteIndex}].file must be a non-empty string`);
  requireValue(!seenFiles.has(suite.file), `duplicate suite file: ${suite.file}`);
  seenFiles.add(suite.file);
  requireValue(Array.isArray(suite.test_cases), `${suite.file}: test_cases must be an array`);

  for (const [caseIndex, testCase] of (suite.test_cases ?? []).entries()) {
    const where = `${suite.file}: test_cases[${caseIndex}]`;
    methodCount++;
    requireValue(typeof testCase.name === "string" && testCase.name.length > 0,
      `${where}.name must be a non-empty string`);
    requireValue(Number.isInteger(testCase.expanded_case_count) && testCase.expanded_case_count > 0,
      `${where}.expanded_case_count must be a positive integer`);
    requireValue(statuses.includes(testCase.status),
      `${where}.status must be one of: ${statuses.join(", ")}`);
    requireValue(typeof testCase.verification === "string" && testCase.verification.length > 0,
      `${where}.verification must be a non-empty string`);

    if (Number.isInteger(testCase.expanded_case_count) && testCase.expanded_case_count > 0) {
      expandedCount += testCase.expanded_case_count;
      if (statuses.includes(testCase.status)) {
        statusCounts[testCase.status] += testCase.expanded_case_count;
      }
    }
  }
}

const supportFiles = report.source_files_without_test_cases ?? [];
for (const [index, item] of supportFiles.entries()) {
  requireValue(typeof item.file === "string" && item.file.length > 0,
    `source_files_without_test_cases[${index}].file must be a non-empty string`);
  requireValue(typeof item.role_or_finding === "string" && item.role_or_finding.length > 0,
    `source_files_without_test_cases[${index}].role_or_finding must be a non-empty string`);
}

const summary = report.summary ?? {};
const methodField = isLegacy ? "decorated_test_methods" : "discovered_test_methods";
const expandedField = isLegacy ? "expanded_nunit_cases" : "expanded_test_cases";
const supportField = isLegacy ? "files_without_nunit_cases" : "files_without_test_cases";
requireValue(summary[methodField] === methodCount,
  `summary.${methodField}=${summary[methodField]}, recomputed=${methodCount}`);
requireValue(summary[expandedField] === expandedCount,
  `summary.${expandedField}=${summary[expandedField]}, recomputed=${expandedCount}`);
requireValue(summary[supportField] === supportFiles.length,
  `summary.${supportField}=${summary[supportField]}, recomputed=${supportFiles.length}`);

for (const status of statuses) {
  const declared = summary.expanded_cases_by_status?.[status] ?? 0;
  requireValue(declared === statusCounts[status],
    `summary.expanded_cases_by_status.${status}=${declared}, recomputed=${statusCounts[status]}`);
}

const declaredStatusTotal = statuses.reduce(
  (total, status) => total + (summary.expanded_cases_by_status?.[status] ?? 0), 0);
requireValue(declaredStatusTotal === expandedCount,
  `status total=${declaredStatusTotal}, expanded cases=${expandedCount}`);

for (const [index, finding] of (report.findings ?? []).entries()) {
  const where = `findings[${index}]`;
  requireValue(typeof finding.id === "string" && finding.id.length > 0,
    `${where}.id must be a non-empty string`);
  requireValue(typeof finding.classification === "string" && finding.classification.length > 0,
    `${where}.classification must be a non-empty string`);
  requireValue(typeof finding.severity === "string" && finding.severity.length > 0,
    `${where}.severity must be a non-empty string`);
  requireValue(typeof finding.file === "string" && finding.file.length > 0,
    `${where}.file must be a non-empty string`);
  requireValue(typeof finding.issue === "string" && finding.issue.length > 0,
    `${where}.issue must be a non-empty string`);
  requireValue(typeof finding.recommended_action === "string" && finding.recommended_action.length > 0,
    `${where}.recommended_action must be a non-empty string`);
  requireValue(Number.isInteger(finding.affected_expanded_cases)
    && finding.affected_expanded_cases >= 0,
    `${where}.affected_expanded_cases must be a non-negative integer`);
}

if (errors.length > 0) {
  console.error(`Audit JSON validation failed (${errors.length} error${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Audit JSON is valid: ${reportPath}`);
console.log(`Schema: ${isLegacy ? "legacy Unity" : "generic"}; methods: ${methodCount}; expanded cases: ${expandedCount}; statuses: ${JSON.stringify(statusCounts)}`);
