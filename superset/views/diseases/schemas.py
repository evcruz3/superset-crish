from marshmallow import fields, Schema

class DiseaseDataSchema(Schema):
    # Composite PK fields
    year = fields.Integer(dump_only=True)
    week_number = fields.Integer(dump_only=True)
    disease = fields.String(dump_only=True)
    municipality_code = fields.String(dump_only=True)

    # Synthetic ID for easier client-side handling (optional but often useful)
    id = fields.Method("get_composite_id", dump_only=True)

    municipality = fields.String(dump_only=True)

    # Main aggregates
    totalCases = fields.Float(dump_only=True, attribute="totalCases")
    totalCasesMale = fields.Float(dump_only=True, attribute="totalCasesMale")
    totalCasesFemale = fields.Float(dump_only=True, attribute="totalCasesFemale")
    totalDeaths = fields.Float(dump_only=True, attribute="totalDeaths")
    totalDeathsMale = fields.Float(dump_only=True, attribute="totalDeathsMale")
    totalDeathsFemale = fields.Float(dump_only=True, attribute="totalDeathsFemale")

    # Age group: LessThan1
    lessThan1TotalCases = fields.Float(dump_only=True, attribute="LessThan1TotalCases")
    lessThan1TotalCasesMale = fields.Float(dump_only=True, attribute="LessThan1TotalCasesMale")
    lessThan1TotalCasesFemale = fields.Float(dump_only=True, attribute="LessThan1TotalCasesFemale")
    lessThan1TotalDeaths = fields.Float(dump_only=True, attribute="LessThan1TotalDeaths")
    lessThan1TotalDeathsMale = fields.Float(dump_only=True, attribute="LessThan1TotalDeathsMale")
    lessThan1TotalDeathsFemale = fields.Float(dump_only=True, attribute="LessThan1TotalDeathsFemale")
    lessThan1CaseMale = fields.Float(dump_only=True, attribute="LessThan1CaseMale")
    lessThan1CaseFemale = fields.Float(dump_only=True, attribute="LessThan1CaseFemale")
    lessThan1DeathMale = fields.Float(dump_only=True, attribute="LessThan1DeathMale")
    lessThan1DeathFemale = fields.Float(dump_only=True, attribute="LessThan1DeathFemale")

    # Age group: 1to4
    oneToFourTotalCases = fields.Float(dump_only=True, attribute="OneToFourTotalCases")
    oneToFourTotalCasesMale = fields.Float(dump_only=True, attribute="OneToFourTotalCasesMale")
    oneToFourTotalCasesFemale = fields.Float(dump_only=True, attribute="OneToFourTotalCasesFemale")
    oneToFourTotalDeaths = fields.Float(dump_only=True, attribute="OneToFourTotalDeaths")
    oneToFourTotalDeathsMale = fields.Float(dump_only=True, attribute="OneToFourTotalDeathsMale")
    oneToFourTotalDeathsFemale = fields.Float(dump_only=True, attribute="OneToFourTotalDeathsFemale")
    oneToFourCaseMale = fields.Float(dump_only=True, attribute="OneToFourCaseMale")
    oneToFourCaseFemale = fields.Float(dump_only=True, attribute="OneToFourCaseFemale")
    oneToFourDeathMale = fields.Float(dump_only=True, attribute="OneToFourDeathMale")
    oneToFourDeathFemale = fields.Float(dump_only=True, attribute="OneToFourDeathFemale")

    # Age group: 5to14
    fiveToFourteenTotalCases = fields.Float(dump_only=True, attribute="FiveToFourteenTotalCases")
    fiveToFourteenTotalCasesMale = fields.Float(dump_only=True, attribute="FiveToFourteenTotalCasesMale")
    fiveToFourteenTotalCasesFemale = fields.Float(dump_only=True, attribute="FiveToFourteenTotalCasesFemale")
    fiveToFourteenTotalDeaths = fields.Float(dump_only=True, attribute="FiveToFourteenTotalDeaths")
    fiveToFourteenTotalDeathsMale = fields.Float(dump_only=True, attribute="FiveToFourteenTotalDeathsMale")
    fiveToFourteenTotalDeathsFemale = fields.Float(dump_only=True, attribute="FiveToFourteenTotalDeathsFemale")
    fiveToFourteenCaseMale = fields.Float(dump_only=True, attribute="FiveToFourteenCaseMale")
    fiveToFourteenCaseFemale = fields.Float(dump_only=True, attribute="FiveToFourteenCaseFemale")
    fiveToFourteenDeathMale = fields.Float(dump_only=True, attribute="FiveToFourteenDeathMale")
    fiveToFourteenDeathFemale = fields.Float(dump_only=True, attribute="FiveToFourteenDeathFemale")

    # Age group: 15Plus
    fifteenPlusTotalCases = fields.Float(dump_only=True, attribute="FifteenPlusTotalCases")
    fifteenPlusTotalCasesMale = fields.Float(dump_only=True, attribute="FifteenPlusTotalCasesMale")
    fifteenPlusTotalCasesFemale = fields.Float(dump_only=True, attribute="FifteenPlusTotalCasesFemale")
    fifteenPlusTotalDeaths = fields.Float(dump_only=True, attribute="FifteenPlusTotalDeaths")
    fifteenPlusTotalDeathsMale = fields.Float(dump_only=True, attribute="FifteenPlusTotalDeathsMale")
    fifteenPlusTotalDeathsFemale = fields.Float(dump_only=True, attribute="FifteenPlusTotalDeathsFemale")
    fifteenPlusCaseMale = fields.Float(dump_only=True, attribute="FifteenPlusCaseMale")
    fifteenPlusCaseFemale = fields.Float(dump_only=True, attribute="FifteenPlusCaseFemale")
    fifteenPlusDeathMale = fields.Float(dump_only=True, attribute="FifteenPlusDeathMale")
    fifteenPlusDeathFemale = fields.Float(dump_only=True, attribute="FifteenPlusDeathFemale")

    week_start_date = fields.DateTime(dump_only=True)

    # Age group: 15to24
    fifteenToTwentyFourTotalCases = fields.Float(dump_only=True, attribute="FifteenToTwentyFourTotalCases")
    fifteenToTwentyFourTotalCasesMale = fields.Float(dump_only=True, attribute="FifteenToTwentyFourTotalCasesMale")
    fifteenToTwentyFourTotalCasesFemale = fields.Float(dump_only=True, attribute="FifteenToTwentyFourTotalCasesFemale")
    fifteenToTwentyFourTotalDeaths = fields.Integer(dump_only=True, attribute="FifteenToTwentyFourTotalDeaths")
    fifteenToTwentyFourTotalDeathsMale = fields.Integer(dump_only=True, attribute="FifteenToTwentyFourTotalDeathsMale")
    fifteenToTwentyFourTotalDeathsFemale = fields.Integer(dump_only=True, attribute="FifteenToTwentyFourTotalDeathsFemale")
    fifteenToTwentyFourCaseMale = fields.Float(dump_only=True, attribute="FifteenToTwentyFourCaseMale")
    fifteenToTwentyFourCaseFemale = fields.Float(dump_only=True, attribute="FifteenToTwentyFourCaseFemale")
    fifteenToTwentyFourDeathMale = fields.Integer(dump_only=True, attribute="FifteenToTwentyFourDeathMale")
    fifteenToTwentyFourDeathFemale = fields.Integer(dump_only=True, attribute="FifteenToTwentyFourDeathFemale")

    # Age group: 25to39
    twentyFiveToThirtyNineTotalCases = fields.Float(dump_only=True, attribute="TwentyFiveToThirtyNineTotalCases")
    twentyFiveToThirtyNineTotalCasesMale = fields.Float(dump_only=True, attribute="TwentyFiveToThirtyNineTotalCasesMale")
    twentyFiveToThirtyNineTotalCasesFemale = fields.Float(dump_only=True, attribute="TwentyFiveToThirtyNineTotalCasesFemale")
    twentyFiveToThirtyNineTotalDeaths = fields.Integer(dump_only=True, attribute="TwentyFiveToThirtyNineTotalDeaths")
    twentyFiveToThirtyNineTotalDeathsMale = fields.Integer(dump_only=True, attribute="TwentyFiveToThirtyNineTotalDeathsMale")
    twentyFiveToThirtyNineTotalDeathsFemale = fields.Integer(dump_only=True, attribute="TwentyFiveToThirtyNineTotalDeathsFemale")
    twentyFiveToThirtyNineCaseMale = fields.Float(dump_only=True, attribute="TwentyFiveToThirtyNineCaseMale")
    twentyFiveToThirtyNineCaseFemale = fields.Float(dump_only=True, attribute="TwentyFiveToThirtyNineCaseFemale")
    twentyFiveToThirtyNineDeathMale = fields.Integer(dump_only=True, attribute="TwentyFiveToThirtyNineDeathMale")
    twentyFiveToThirtyNineDeathFemale = fields.Integer(dump_only=True, attribute="TwentyFiveToThirtyNineDeathFemale")

    # Age group: 40to59
    fortyToFiftyNineTotalCases = fields.Float(dump_only=True, attribute="FortyToFiftyNineTotalCases")
    fortyToFiftyNineTotalCasesMale = fields.Float(dump_only=True, attribute="FortyToFiftyNineTotalCasesMale")
    fortyToFiftyNineTotalCasesFemale = fields.Float(dump_only=True, attribute="FortyToFiftyNineTotalCasesFemale")
    fortyToFiftyNineTotalDeaths = fields.Integer(dump_only=True, attribute="FortyToFiftyNineTotalDeaths")
    fortyToFiftyNineTotalDeathsMale = fields.Integer(dump_only=True, attribute="FortyToFiftyNineTotalDeathsMale")
    fortyToFiftyNineTotalDeathsFemale = fields.Integer(dump_only=True, attribute="FortyToFiftyNineTotalDeathsFemale")
    fortyToFiftyNineCaseMale = fields.Float(dump_only=True, attribute="FortyToFiftyNineCaseMale")
    fortyToFiftyNineCaseFemale = fields.Float(dump_only=True, attribute="FortyToFiftyNineCaseFemale")
    fortyToFiftyNineDeathMale = fields.Integer(dump_only=True, attribute="FortyToFiftyNineDeathMale")
    fortyToFiftyNineDeathFemale = fields.Integer(dump_only=True, attribute="FortyToFiftyNineDeathFemale")

    # Age group: 60Plus
    sixtyPlusTotalCases = fields.Float(dump_only=True, attribute="SixtyPlusTotalCases")
    sixtyPlusTotalCasesMale = fields.Integer(dump_only=True, attribute="SixtyPlusTotalCasesMale")
    sixtyPlusTotalCasesFemale = fields.Float(dump_only=True, attribute="SixtyPlusTotalCasesFemale")
    sixtyPlusTotalDeaths = fields.Integer(dump_only=True, attribute="SixtyPlusTotalDeaths")
    sixtyPlusTotalDeathsMale = fields.Integer(dump_only=True, attribute="SixtyPlusTotalDeathsMale")
    sixtyPlusTotalDeathsFemale = fields.Integer(dump_only=True, attribute="SixtyPlusTotalDeathsFemale")
    sixtyPlusCaseMale = fields.Integer(dump_only=True, attribute="SixtyPlusCaseMale")
    sixtyPlusCaseFemale = fields.Float(dump_only=True, attribute="SixtyPlusCaseFemale")
    sixtyPlusDeathMale = fields.Integer(dump_only=True, attribute="SixtyPlusDeathMale")
    sixtyPlusDeathFemale = fields.Integer(dump_only=True, attribute="SixtyPlusDeathFemale")

    class Meta:
        ordered = True

    def get_composite_id(self, obj):
        # This method assumes 'obj' is an instance of the DiseaseData model
        return f"{obj.year}_{obj.week_number}_{obj.disease}_{obj.municipality_code}"

# openapi_spec_methods_override = {
#     "get_list": {
#         "get": {
#             "summary": "Get a list of disease data entries",
#             "description": (
#                 "Retrieves a list of disease data entries. "
#                 "Supports filtering via direct query parameters (e.g., year=2023, disease=Dengue) "
#                 "and/or the 'q' rison parameter for complex queries (filters, ordering, pagination). "
#                 "Pagination can be controlled using `page` and `page_size` either directly as query "
#                 "parameters or within the 'q' rison payload. Set `page_size` to -1 to retrieve all matching entries."
#             ),
#             "parameters": [
#                 {
#                     "in": "query",
#                     "name": "q",
#                     "content": {
#                         "application/json": {
#                             "schema": {
#                                 "$ref": "#/components/schemas/get_list_schema"
#                             }
#                         }
#                     },
#                     "description": (
#                         "A Rison-encoded query for comprehensive filtering, sorting, and pagination. "
#                         "Example for filtering by Dengue and first page: "
#                         "q=(filters:!((col:disease,opr:eq,value:Dengue)),page:0,page_size:25)"
#                     )
#                 },
#                 {
#                     "name": "year",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "integer"},
#                     "description": "Filter by exact year (e.g., 2023)."
#                 },
#                 {
#                     "name": "week_number",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "integer"},
#                     "description": "Filter by exact week number."
#                 },
#                 {
#                     "name": "disease",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "string"},
#                     "description": "Filter by exact disease name (case-sensitive)."
#                 },
#                 {
#                     "name": "municipality_code",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "string"},
#                     "description": "Filter by exact municipality code."
#                 },
#                 {
#                     "name": "municipality",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "string"},
#                     "description": "Filter by exact municipality name (case-sensitive)."
#                 },
#                 {
#                     "name": "page",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "integer"},
#                     "description": "Page number for pagination (0-indexed). Used if 'page' is not in 'q'."
#                 },
#                 {
#                     "name": "page_size",
#                     "in": "query",
#                     "required": False,
#                     "schema": {"type": "integer"},
#                     "description": "Number of results per page. Set to -1 to retrieve all results. Used if 'page_size' is not in 'q'."
#                 }
#             ],
#             "responses": {
#                 "200": {
#                     "description": "A list of disease data entries",
#                     "content": {
#                         "application/json": {
#                             "schema": {
#                                 "type": "object",
#                                 "properties": {
#                                     "ids": {
#                                         "type": "array",
#                                         "items": {"type": "string"},
#                                         "description": "A list of entry IDs (composite keys)"
#                                     },
#                                     "count": {"type": "integer"},
#                                     "result": {
#                                         "type": "array",
#                                         "items": {
#                                             "$ref": "#/components/schemas/DiseaseDataSchema"
#                                         }
#                                     },
#                                     "page": {"type": "integer"},
#                                     "page_size": {"type": "integer"},
#                                     "total_pages": {"type": "integer"},
#                                     "next_page_url": {"type": ["string", "null"]},
#                                     "prev_page_url": {"type": ["string", "null"]}
#                                 }
#                             }
#                         }
#                     }
#                 },
#                 "400": {"$ref": "#/components/responses/400"},
#                 "401": {"$ref": "#/components/responses/401"},
#                 "422": {"$ref": "#/components/responses/422"},
#                 "500": {"$ref": "#/components/responses/500"}
#             }
#         }
#     }
# } 