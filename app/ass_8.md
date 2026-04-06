# Assignment 8: White Box and Black Box Testing (Part B)

## What Is Testing?
Testing is the process of checking whether software behaves correctly. It helps find bugs early, confirms that features work as expected, and increases confidence before submission or deployment.

There are two main styles commonly used in labs:
- **White Box Testing** (Glass Box): tests internal code logic.
- **Black Box Testing** (Functional): tests behavior from the user/API perspective.

## White Box Testing (Glass Box)
White box testing focuses on the **internal structure of the code**.  
The tester knows how the code is written and designs tests to cover:
- `if/else` branches
- loops
- error handling
- edge cases

### White Box Test Cases (Designed)
| Test ID | Module | Input / Condition | Expected Output |
| --- | --- | --- | --- |
| WB-01 | `AnalysisEngine` | One valid line + one malformed line | `parseErrors` increments and report still generated |
| WB-02 | `AnalysisEngine` | Entry not detected as incident | No incident created, response planner not called |
| WB-03 | `LogSourceResolver` | Explicit `.log` file list provided | Resolves to absolute paths |
| WB-04 | `LogSourceResolver` | Custom directory has no `.log` files | Throws error |
| WB-05 | `IncidentOrchestrator` | `persistReport=true` | Repository save called |
| WB-06 | `IncidentRepository` | Save report with incidents + entries | All repositories called |
| WB-07 | `PdfAnalysisService` | Upload PDF with valid log text | Extracts lines and stores metadata |
| WB-08 | `IncidentRepository` | Fetch upload details | Returns upload + report info |

### White Box Tests Implemented (Where)
From `my-app/server/tests/white-box/`:
- `AnalysisEngine.test.js`
- `LogSourceResolver.test.js`
- `IncidentOrchestrator.test.js`
- `IncidentRepository.test.js`
- `PdfAnalysisService.test.js`

## Black Box Testing (Functional Testing)
Black box testing focuses on **inputs and outputs only**, without looking at internal code.  
It verifies that the system behaves correctly for a user or API client.

### Black Box Test Cases (Designed)
| Test ID | Endpoint | Input | Expected Output |
| --- | --- | --- | --- |
| BB-01 | `GET /api/health` | No body | `200 OK` + status |
| BB-02 | `POST /api/analyze` | Valid `.log` file list | `200 OK` + report |
| BB-03 | `POST /api/analyze` | Invalid file extension | `400` error |
| BB-04 | `GET /api/report/latest` | No report exists | `404` error |
| BB-05 | `POST /api/analyze/upload` | Upload `.log` file | `200 OK` + report |
| BB-06 | `POST /api/analyze/pdf` | Upload `.pdf` | `200 OK` + report |
| BB-07 | `GET /api/uploads` | No body | `200 OK` + upload list |
| BB-08 | `GET /api/uploads/:uploadId` | Valid upload id | `200 OK` + details |
| BB-09 | `GET /api/uploads/:uploadId` | Invalid upload id | `404` error |

### Black Box Tests Implemented (Where)
From `my-app/server/tests/black-box/analysisApi.test.js`

## Key Differences (Summary)
| Feature | White Box | Black Box |
| --- | --- | --- |
| Code visibility | Known | Hidden |
| Focus | Logic & branches | Inputs & outputs |
| Example | Parse error branch | API returns correct status |

## Why We Use Both
- **White box** ensures internal logic works correctly.
- **Black box** ensures the system behaves correctly for users.

Using both gives full confidence that the software is correct and reliable.

## Test Execution (Performed)
Command used:
```powershell
cd my-app/server
npm.cmd test
```

Observed result:
- Test Suites: `6 passed, 6 total`
- Tests: `26 passed, 26 total`

This confirms both white-box and black-box test cases executed successfully.
