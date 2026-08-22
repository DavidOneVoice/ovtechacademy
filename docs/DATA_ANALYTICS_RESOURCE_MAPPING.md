# Data Analytics LMS resource mapping

This inventory was taken from `public/lms-resources`. Public paths are exact and
case-sensitive. Files used by the Computer Programming curriculum remain in the
inventory but are not mapped or modified by the Data Analytics importer.

## Local file inventory (29 files)

| Filename | Extension | Relative public path |
|---|---|---|
| `CSS Basics  (Links).docx` | `.docx` | `/lms-resources/CSS Basics  (Links).docx` |
| `DateTable.xlsx` | `.xlsx` | `/lms-resources/DateTable.xlsx` |
| `EXCEL FINAL PROJECT.docx` | `.docx` | `/lms-resources/EXCEL FINAL PROJECT.docx` |
| `EXCEL SHORTCUTS.jpg` | `.jpg` | `/lms-resources/EXCEL SHORTCUTS.jpg` |
| `Excel Final Project Dataset.xlsx` | `.xlsx` | `/lms-resources/Excel Final Project Dataset.xlsx` |
| `Excel Mini - Project 1.docx` | `.docx` | `/lms-resources/Excel Mini - Project 1.docx` |
| `Excel Mini Project 2.docx` | `.docx` | `/lms-resources/Excel Mini Project 2.docx` |
| `Excel Mini-Project 4 DATASET.xlsx` | `.xlsx` | `/lms-resources/Excel Mini-Project 4 DATASET.xlsx` |
| `Excel Mini-Project 4.docx` | `.docx` | `/lms-resources/Excel Mini-Project 4.docx` |
| `Final Project (Links).docx` | `.docx` | `/lms-resources/Final Project (Links).docx` |
| `Getting Started (Links).docx` | `.docx` | `/lms-resources/Getting Started (Links).docx` |
| `HTML Tags (Links).docx` | `.docx` | `/lms-resources/HTML Tags (Links).docx` |
| `Introduction (Links).docx` | `.docx` | `/lms-resources/Introduction (Links).docx` |
| `MINI PROJECT 3.docx` | `.docx` | `/lms-resources/MINI PROJECT 3.docx` |
| `Notes.docx` | `.docx` | `/lms-resources/Notes.docx` |
| `OVTech DA Capstone Project Question.xlsx` | `.xlsx` | `/lms-resources/OVTech DA Capstone Project Question.xlsx` |
| `Other Useful CSS Props (Links).docx` | `.docx` | `/lms-resources/Other Useful CSS Props (Links).docx` |
| `SQLNotes.docx` | `.docx` | `/lms-resources/SQLNotes.docx` |
| `SalesData.xlsx` | `.xlsx` | `/lms-resources/SalesData.xlsx` |
| `SalesData2.csv` | `.csv` | `/lms-resources/SalesData2.csv` |
| `Semantic Mark Ups (Links).docx` | `.docx` | `/lms-resources/Semantic Mark Ups (Links).docx` |
| `Test+sample.xlsx` | `.xlsx` | `/lms-resources/Test+sample.xlsx` |
| `Version Control  (Links).docx` | `.docx` | `/lms-resources/Version Control  (Links).docx` |
| `countries.csv` | `.csv` | `/lms-resources/countries.csv` |
| `datahandbook.pdf` | `.pdf` | `/lms-resources/datahandbook.pdf` |
| `films.csv` | `.csv` | `/lms-resources/films.csv` |
| `list_of_countries_and_dependencies.csv` | `.csv` | `/lms-resources/list_of_countries_and_dependencies.csv` |
| `list_of_countries_and_dependencies.xlsx` | `.xlsx` | `/lms-resources/list_of_countries_and_dependencies.xlsx` |
| `movie_ratings.csv` | `.csv` | `/lms-resources/movie_ratings.csv` |

## Workbook resource mapping (19 rows)

“Automatic” means the normalized workbook title uniquely equals a normalized
filename stem. “Explicit” identifies a reviewed exception in the importer's
isolated Data Analytics override map.

| sourceLessonId | Resource title | fileType | Matched filename | storagePath | Match confidence |
|---|---|---|---|---|---|
| `DF-RES016` | Data Fundamentals Handbook | PDF | `datahandbook.pdf` | `/lms-resources/datahandbook.pdf` | High — explicit; distinctive handbook name and PDF type |
| `EX-RES017` | Excel Mini Project 1 | Word Document | `Excel Mini - Project 1.docx` | `/lms-resources/Excel Mini - Project 1.docx` | High — automatic normalized-title match |
| `EX-RES030` | Test Sample | Spreadsheet | `Test+sample.xlsx` | `/lms-resources/Test+sample.xlsx` | High — automatic normalized-title match |
| `EX-RES031` | Excel Mini Project 2 | Word Document | `Excel Mini Project 2.docx` | `/lms-resources/Excel Mini Project 2.docx` | High — automatic normalized-title match |
| `EX-RES043` | Mini Project 3 | Word Document | `MINI PROJECT 3.docx` | `/lms-resources/MINI PROJECT 3.docx` | High — automatic normalized-title match |
| `EX-RES067` | Excel Mini-Project 4 Dataset | Spreadsheet | `Excel Mini-Project 4 DATASET.xlsx` | `/lms-resources/Excel Mini-Project 4 DATASET.xlsx` | High — automatic normalized-title match |
| `EX-RES068` | Excel Mini-Project 4 | Word Document | `Excel Mini-Project 4.docx` | `/lms-resources/Excel Mini-Project 4.docx` | High — automatic normalized-title match |
| `EX-RES077` | list_of_countries_and_dependencies | Spreadsheet | `list_of_countries_and_dependencies.xlsx` | `/lms-resources/list_of_countries_and_dependencies.xlsx` | High — explicit; `.csv` and `.xlsx` stems are ambiguous, `.xlsx` chosen for workbook context |
| `PQ-RES001` | films | Spreadsheet | `films.csv` | `/lms-resources/films.csv` | High — automatic normalized-title match |
| `PQ-RES002` | movie_ratings | Spreadsheet | `movie_ratings.csv` | `/lms-resources/movie_ratings.csv` | High — automatic normalized-title match |
| `EX-RES088` | Excel Final Project Dataset | Spreadsheet | `Excel Final Project Dataset.xlsx` | `/lms-resources/Excel Final Project Dataset.xlsx` | High — automatic normalized-title match |
| `EX-RES089` | Excel Final Project | Word Document | `EXCEL FINAL PROJECT.docx` | `/lms-resources/EXCEL FINAL PROJECT.docx` | High — automatic normalized-title match |
| `PB-RES030` | DateTable | Spreadsheet | `DateTable.xlsx` | `/lms-resources/DateTable.xlsx` | High — automatic normalized-title match |
| `PB-RES031` | SalesData | Spreadsheet | `SalesData.xlsx` | `/lms-resources/SalesData.xlsx` | High — automatic normalized-title match |
| `PB-RES032` | SalesData2 | Spreadsheet | `SalesData2.csv` | `/lms-resources/SalesData2.csv` | High — automatic normalized-title match |
| `SQL-RES001` | films | Spreadsheet | `films.csv` | `/lms-resources/films.csv` | High — automatic normalized-title match and SQL section context |
| `SQL-RES002` | movie_ratings | Spreadsheet | `movie_ratings.csv` | `/lms-resources/movie_ratings.csv` | High — automatic normalized-title match and SQL section context |
| `SQL-RES003` | Notes | Word Document | `SQLNotes.docx` | `/lms-resources/SQLNotes.docx` | High — explicit; SQL course context distinguishes it from `Notes.docx` |
| `PY021` | Capstone Project | Spreadsheet | `OVTech DA Capstone Project Question.xlsx` | `/lms-resources/OVTech DA Capstone Project Question.xlsx` | High — explicit; Data Analytics capstone context and spreadsheet type |

All 19 rows are resolved: 15 by automatic matching and 4 by explicit reviewed
mapping. Local mappings populate `storagePath`; they do not populate
`downloadUrl`.
