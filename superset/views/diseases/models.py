from sqlalchemy import Column, Integer, String, DateTime, Float
from flask_appbuilder import Model
from superset.models.helpers import AuditMixinNullable # Standard Superset mixins

class DiseaseData(Model):
    __tablename__ = "tlhis_diseases" # You can change this if your table name is different

    # Composite Primary Key
    year = Column(Integer, primary_key=True, nullable=False)
    week_number = Column(Integer, primary_key=True, nullable=False)
    disease = Column(String(255), primary_key=True, nullable=False) # Assuming VARCHAR(255)
    municipality_code = Column(String(50), primary_key=True, nullable=False) # Assuming VARCHAR(50)

    municipality = Column(String(255))

    # Main aggregates
    totalCases = Column(Float)
    totalCasesMale = Column(Float)
    totalCasesFemale = Column(Float)
    totalDeaths = Column(Float)
    totalDeathsMale = Column(Float)
    totalDeathsFemale = Column(Float)

    # Age group: LessThan1
    LessThan1TotalCases = Column(Float)
    LessThan1TotalCasesMale = Column(Float)
    LessThan1TotalCasesFemale = Column(Float)
    LessThan1TotalDeaths = Column(Float)
    LessThan1TotalDeathsMale = Column(Float)
    LessThan1TotalDeathsFemale = Column(Float)
    LessThan1CaseMale = Column(Float)
    LessThan1CaseFemale = Column(Float)
    LessThan1DeathMale = Column(Float)
    LessThan1DeathFemale = Column(Float, name="LessThan1DeathFemale")

    # Age group: 1to4
    OneToFourTotalCases = Column(Float, name="1to4TotalCases")
    OneToFourTotalCasesMale = Column(Float, name="1to4TotalCasesMale")
    OneToFourTotalCasesFemale = Column(Float, name="1to4TotalCasesFemale")
    OneToFourTotalDeaths = Column(Float, name="1to4TotalDeaths")
    OneToFourTotalDeathsMale = Column(Float, name="1to4TotalDeathsMale")
    OneToFourTotalDeathsFemale = Column(Float, name="1to4TotalDeathsFemale")
    OneToFourCaseMale = Column(Float, name="1to4CaseMale")
    OneToFourCaseFemale = Column(Float, name="1to4CaseFemale")
    OneToFourDeathMale = Column(Float, name="1to4DeathMale")
    OneToFourDeathFemale = Column(Float, name="1to4DeathFemale")

    # Age group: 5to14
    FiveToFourteenTotalCases = Column(Float, name="5to14TotalCases")
    FiveToFourteenTotalCasesMale = Column(Float, name="5to14TotalCasesMale")
    FiveToFourteenTotalCasesFemale = Column(Float, name="5to14TotalCasesFemale")
    FiveToFourteenTotalDeaths = Column(Float, name="5to14TotalDeaths")
    FiveToFourteenTotalDeathsMale = Column(Float, name="5to14TotalDeathsMale")
    FiveToFourteenTotalDeathsFemale = Column(Float, name="5to14TotalDeathsFemale")
    FiveToFourteenCaseMale = Column(Float, name="5to14CaseMale")
    FiveToFourteenCaseFemale = Column(Float, name="5to14CaseFemale")
    FiveToFourteenDeathMale = Column(Float, name="5to14DeathMale")
    FiveToFourteenDeathFemale = Column(Float, name="5to14DeathFemale")

    # Age group: 15Plus
    FifteenPlusTotalCases = Column(Float, name="15PlusTotalCases")
    FifteenPlusTotalCasesMale = Column(Float, name="15PlusTotalCasesMale")
    FifteenPlusTotalCasesFemale = Column(Float, name="15PlusTotalCasesFemale")
    FifteenPlusTotalDeaths = Column(Float, name="15PlusTotalDeaths")
    FifteenPlusTotalDeathsMale = Column(Float, name="15PlusTotalDeathsMale")
    FifteenPlusTotalDeathsFemale = Column(Float, name="15PlusTotalDeathsFemale")
    FifteenPlusCaseMale = Column(Float, name="15PlusCaseMale")
    FifteenPlusCaseFemale = Column(Float, name="15PlusCaseFemale")
    FifteenPlusDeathMale = Column(Float, name="15PlusDeathMale")
    FifteenPlusDeathFemale = Column(Float, name="15PlusDeathFemale")

    week_start_date = Column(DateTime) # TIMESTAMP

    # Age group: 15to24
    FifteenToTwentyFourTotalCases = Column(Float, name="15to24TotalCases")
    FifteenToTwentyFourTotalCasesMale = Column(Float, name="15to24TotalCasesMale")
    FifteenToTwentyFourTotalCasesFemale = Column(Float, name="15to24TotalCasesFemale")
    FifteenToTwentyFourTotalDeaths = Column(Integer, name="15to24TotalDeaths")
    FifteenToTwentyFourTotalDeathsMale = Column(Integer, name="15to24TotalDeathsMale")
    FifteenToTwentyFourTotalDeathsFemale = Column(Integer, name="15to24TotalDeathsFemale")
    FifteenToTwentyFourCaseMale = Column(Float, name="15to24CaseMale")
    FifteenToTwentyFourCaseFemale = Column(Float, name="15to24CaseFemale")
    FifteenToTwentyFourDeathMale = Column(Integer, name="15to24DeathMale")
    FifteenToTwentyFourDeathFemale = Column(Integer, name="15to24DeathFemale")

    # Age group: 25to39
    TwentyFiveToThirtyNineTotalCases = Column(Float, name="25to39TotalCases")
    TwentyFiveToThirtyNineTotalCasesMale = Column(Float, name="25to39TotalCasesMale")
    TwentyFiveToThirtyNineTotalCasesFemale = Column(Float, name="25to39TotalCasesFemale")
    TwentyFiveToThirtyNineTotalDeaths = Column(Integer, name="25to39TotalDeaths")
    TwentyFiveToThirtyNineTotalDeathsMale = Column(Integer, name="25to39TotalDeathsMale")
    TwentyFiveToThirtyNineTotalDeathsFemale = Column(Integer, name="25to39TotalDeathsFemale")
    TwentyFiveToThirtyNineCaseMale = Column(Float, name="25to39CaseMale")
    TwentyFiveToThirtyNineCaseFemale = Column(Float, name="25to39CaseFemale")
    TwentyFiveToThirtyNineDeathMale = Column(Integer, name="25to39DeathMale")
    TwentyFiveToThirtyNineDeathFemale = Column(Integer, name="25to39DeathFemale")

    # Age group: 40to59
    FortyToFiftyNineTotalCases = Column(Float, name="40to59TotalCases")
    FortyToFiftyNineTotalCasesMale = Column(Float, name="40to59TotalCasesMale")
    FortyToFiftyNineTotalCasesFemale = Column(Float, name="40to59TotalCasesFemale")
    FortyToFiftyNineTotalDeaths = Column(Integer, name="40to59TotalDeaths")
    FortyToFiftyNineTotalDeathsMale = Column(Integer, name="40to59TotalDeathsMale")
    FortyToFiftyNineTotalDeathsFemale = Column(Integer, name="40to59TotalDeathsFemale")
    FortyToFiftyNineCaseMale = Column(Float, name="40to59CaseMale")
    FortyToFiftyNineCaseFemale = Column(Float, name="40to59CaseFemale")
    FortyToFiftyNineDeathMale = Column(Integer, name="40to59DeathMale")
    FortyToFiftyNineDeathFemale = Column(Integer, name="40to59DeathFemale")

    # Age group: 60Plus
    SixtyPlusTotalCases = Column(Float, name="60PlusTotalCases")
    SixtyPlusTotalCasesMale = Column(Integer, name="60PlusTotalCasesMale")
    SixtyPlusTotalCasesFemale = Column(Float, name="60PlusTotalCasesFemale")
    SixtyPlusTotalDeaths = Column(Integer, name="60PlusTotalDeaths")
    SixtyPlusTotalDeathsMale = Column(Integer, name="60PlusTotalDeathsMale")
    SixtyPlusTotalDeathsFemale = Column(Integer, name="60PlusTotalDeathsFemale")
    SixtyPlusCaseMale = Column(Integer, name="60PlusCaseMale")
    SixtyPlusCaseFemale = Column(Float, name="60PlusCaseFemale")
    SixtyPlusDeathMale = Column(Integer, name="60PlusDeathMale")
    SixtyPlusDeathFemale = Column(Integer, name="60PlusDeathFemale")

    # Helper to get the string representation of the composite primary key
    def get_pk_value(self) -> str:
        return f"{self.year}_{self.week_number}_{self.disease}_{self.municipality_code}"

    # For more straightforward reference in API definitions if needed
    _pk_columns = ["year", "week_number", "disease", "municipality_code"]

    def __repr__(self):
        return (
            f"DiseaseData(Year: {self.year}, Week: {self.week_number}, "
            f"Disease: {self.disease}, MuniCode: {self.municipality_code})"
        ) 