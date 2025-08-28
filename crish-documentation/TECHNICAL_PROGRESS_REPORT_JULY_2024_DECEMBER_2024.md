

1. Introduction	2
2. Technical Accomplishments and Milestones	4
2.1. User Needs and Feedback	4
2.2. Technology Considerations	5
2.3. Data Needs and Scoping	7
2.4. Features and Functionalities	9
2.4.1. Crish’s System Architecture	9
2.4.2. Overview Module	10
2.4.2.1. Weather Alerts for Health Decision Support:	10
2.4.2.2. Disease Case Trends:	11
2.4.2.3. Interactive Map with Weather Parameters:	11
2.4.3. Healthcare Facilities	12
2.4.4. Weather Forecast Module	15
2.4.5. Diseases Module	17
2.4.6. Bulletins and Advisories	19
2.4.7. Alerts and Reports	22
2.4.8. Multilingual Support	2	25
2.5. Challenges	25
3. Ways Forward and Planned Activities	27
Introduction

Brief introduction to the report. You may identify relevant sections below. Describe how your work will contribute to the project activity and sub-activities.

The ‘Enhancing Early Warning Systems to build greater resilience to hydro-meteorological hazards in Timor-Leste’ is a USD 21.7 million project led by the United Nations Environment Programme (UNEP) and funded by the Green Climate Fund (GCF) to establish integrated climate information services covering oceans and impact-based Multi-Hazard Early Warning System (MHEWS) for sectors (including health, agriculture, disaster risk reduction, water and environmental management) and communities in Timor-Leste. As part of this project, the Regional Integrated Multi-Hazard Early Warning System for Africa and Asia (RIMES) contributes to several project components. Among these components, establishing impact-based forecasting and decision-support systems (DSS) for agriculture, disaster risk reduction, and marine sectors and co-developing tailored forecasting and decision support for health are some of the key activities that RIMES is implementing.

Result 2: Strengthened observations, monitoring, analysis and forecasting of climate and its impacts
Activity 2.1 – Enhance infrastructure and technical support for observations and monitoring 
Sub-activity 2.1.1: Expand and upgrade the meteorological observation network to GBON standards (RIMES to focus on ocean buoy)
Ocean observations and monitoring enhanced based on national requirements outlined in the Network Development Plan – including deployment of 1 marine buoy, tide gauge, depth sonar and ocean drone

Activity 2.2 – Strengthen climate modelling and impact-based forecasting 
Sun-activity 2.2.3: Establish impact-based forecasting and decision-support systems for agriculture, disaster risk reduction, and marine sectors
Training and workshops on impact-based forecasting and sector- specific decision support systems (DSS) for DNMG, NDMD and MAF 
Training and capacity building workshops on ocean modelling and marine forecasting, including customization of ocean forecast products
Sector-specific DSS for disaster risk management, agriculture and water/marine sectors established (e.g., SMART, OSFAS, SESAME) 
Mobile applications for SMART, OSFAS and SESAME DSS developed 


Activity 2.3 – Establish climate services for health 
This Activity will address the increasing demand for relevant, timely and usable information about weather and climate variability, change, risks and impacts to enable decision- makers to take appropriate actions to keep people safe and healthy. This will include institutional strengthening through establishment of a national Climate and Health Working Group; establishment of a hybrid ambient air quality monitoring system and customized mobile application; and the co-development and delivery of tailored forecasting and health decision-support systems, including a mobile application. 
Sub-activity 2.3.3: Co-develop tailored forecasting and decision support for health
Lead agency: UNEP
RIMES deliverables:
Sector-specific DSS for health sector established 
Capacity building workshops for the Ministry of Health and related authorities conducted to identify the required data for analysis, modelling and decision-making 


Sub-activity 2.3.4: Develop a mobile app for health-related forecasts and advisories 
Lead agency: UNEP
RIMES deliverables:
Mobile application for health-related forecasts and advisories developed 
Technical Accomplishments and Milestones

Provide highlights of your work and accomplishments from January to June 2024. Describe briefly your methodology and initial outputs. Provide also sample screenshots of your outputs. Further, identify the challenges that limit your work and cause delays.

User Needs and Feedback
The DSS was generally perceived to hold significant potential in forecasting and mitigating risks associated with climate change by integration of climate and weather data with health surveillance information.

With the DSS, data can be collected and put together in a centralized repository, where different stakeholders can access and analyze information. These data can be used to formalize, through models and thresholds, the relationship between weather/climate and health events. It will also help establish the localized threshold for Timor Leste.

In addition, strategic planning and resource allocation can also be supported by the system by identifying hotspots. Targeted approaches can be done to maximize the effectiveness of limited resources and enhance community resilience. The support for early warning is very beneficial not just to line workers but also to the public. It ensures that correct and reliable health information can be released to the public.

The DSS also serves as a critical educational tool, raising public awareness about the health impacts of climate change. Through timely and accessible information dissemination, it empowers communities with knowledge and practical guidance on preventive measures to protect themselves during adverse climatic conditions. This proactive engagement helps cultivate a culture of preparedness and self-sufficiency among the populace, significantly reducing the potential human toll of climate-related events and strengthening public service.

Below is the summary of the User Needs Assessment and System Validation and the  list of features and functionalities for Timor Leste implementation of the climate and health DSS, CRISH.

Summary of User Needs Assessment and System Validation Result
The process was a collaborative effort, initiated with a detailed user needs assessment and system validation. This was conducted through focus group discussions (FGDs) with key stakeholders from the health sector and technical working groups, including meteorologists, IT experts, and health professionals from the Ministry of Health and other related agencies. The development process, stakeholder engagement, and strategic planning involved in implementing the Climate and Health Decision Support System (DSS), known as CRISH, in Timor Leste was thoroughly discussed, emphasizing the importance of each stakeholder's contribution.

The discussions were about more than just introducing the CRISH system and demonstrating its features. They were also about validating the features already being implemented and the priority health issues it should address, such as malaria, dengue, and other vector-borne diseases. These diseases have been correlated with climatic factors like rainfall, making it crucial for the DSS to integrate weather and health data effectively. The stakeholders' feedback on the system’s proposed functionalities was highly valued, emphasizing the need for real-time data collection, a centralized data repository, and capabilities for generating actionable alerts and advisories.

The discussions also highlighted the need for the system to support inclusive reports that account for sex, age, and disability disaggregated data (SADDD) to enhance the assessment of interventions and aid in targeted response planning.

Furthermore, the discussion highlighted the importance of developing features within the DSS to monitor and advise on acute respiratory disease, which is becoming increasingly relevant due to the reported increase in respiratory diseases. However, a direct link to climate change has yet to be established.

The next steps involve extensive data collection across all relevant offices, continuous stakeholder engagement to refine the system's functionalities, and the continuation of the development and localization of models to ensure CRISH’s effectiveness in the specific context of Timor Leste. The system's success hinges on its ability to provide timely, accurate, and actionable information that can significantly mitigate the public health impacts of climate variability and change.

Technology Considerations

CRISH is built on top of Apache Superset, an open-source data visualization and business intelligence platform, and customized to meet the specific requirements of the healthcare and public health sector. This decision to use Superset as the underlying technology stems from its versatility, scalability, and robust capabilities in data exploration, visualization, and integration with diverse data sources.

Furthermore, it is designed to handle large-scale data analysis needs and is well-suited for environments requiring real-time data exploration and actionable insights. Superset’s modularity allows for extensive customization, which is critical in tailoring the system for specific use cases, such as public health surveillance, disease tracking, and weather-related decision support.

Data Integration Capabilities
Superset seamlessly integrates with various data sources, including relational databases (PostgreSQL, MySQL, SQLite), NoSQL databases (MongoDB), and external APIs. For CRISH, this integration allows the system to pull data from diverse sources such as:
ECMWF weather data from RIMES for real-time weather parameters (e.g., rainfall, temperature, humidity).
Disease case data from weekly surveillance systems uploaded in .xls or .xlsx formats.
This flexibility ensures a single, unified platform for all relevant datasets, enabling comprehensive analysis.

Real-Time Data Processing
The CRISH DSS requires real-time updates for weather and disease data to provide actionable insights. Superset supports real-time data querying and caching, ensuring that the dashboards always reflect the latest data without performance bottlenecks.

Customizability for Health Needs
While Superset provides a strong foundation, its extensible architecture allows for customization to meet specific health decision support needs:
Custom Modules: Features such as the Disease Overview, Weather Forecasts, Alerts and Reports, and other features were developed as custom modules within Superset, tailored for health surveillance, public health advisories, and automated notifications.
Custom Visualization Plugins: The integration of deck.gl for geospatial data visualizations and OpenStreetMap layers enables advanced mapping capabilities. These are critical for displaying disease case distributions, health facilities, and weather parameters.

Automated Reporting and Alerts
Superset’s built-in alerting and reporting features were customized to support health-specific use cases:
Automated generation of reports (e.g., weekly disease case trends, weather risk summaries).
Email notifications with scheduled dashboards or threshold-based alerts for key health indicators, ensuring timely dissemination of critical updates to stakeholders.

User-Friendly Interface
The CRISH is designed to be accessible to a broad range of users, including public health officials, healthcare providers, and policymakers. Superset’s interactive dashboards and visualizations provide an intuitive user experience, making complex data easy to understand and actionable without requiring advanced technical skills.

Open-Source and Cost-Effectiveness
As an open-source platform, Superset eliminates licensing costs while providing enterprise-grade features. This is particularly important in public health contexts, where budgets may be constrained, yet there is a need for robust and reliable technology solutions.

Scalability and Security:
Superset’s architecture supports scaling to accommodate large datasets and concurrent users, ensuring that the system can grow with increasing data and user demands. Its integration with Keycloak for authentication provides a secure, role-based access control system tailored to the needs of CRISH.

Data Needs and Scoping


Data Source
Purpose
Variables / Parameters
Status
Weather Data
For Visualization of Real Time Weather Data
Rainfall
Temperature Across Various Heights
Humidity
Available data from dataex.rimes.int
Weather Forecast Data
For visualization of forecast data in (possible) combination of geo distribution of projected cases
Rainfall
Temperature Across Various Heights
Humidity
Available data from dataex.rimes.int
Facilities
For mapping of all healthcare facilities in Timor Leste
Facility name
Facility type
Address
Lat,lng
Ownership
Operating hours
Patient Capacity
Specializations


Actual data acquired in xlsx format (as of November 2024)
Dengue Case Reports
For visualization and analysis of dengue cases in Timor Leste
Reporting Entity Type 
Sex-based Count
Age-based Count
Reporting Date
Case Period	
Actual data in xlsx format from TLHIS (as of November 2024)
Diarrhea Case Reports
For visualization and analysis of diarrhea cases in Timor Leste
Reporting Entity Type 
Sex-based Count
Age-based Count
Reporting Date
Case Period	
Actual data in xlsx format from TLHIS (as of November 2024)
Dengue Case Model
For projection of dengue cases based from historical data


Awaiting model
Diarrhea Model 
For projection of diarrhea cases based from historical data


Awaiting model
Healthcare Roles
For role-based access in the system
Role Title
Description of Roles
Access to Components	
Awaiting from the stakeholders
Advisories
For templating of public advisories and information


-  None from local samples  yet, reference samples from other countries are available


Features and Functionalities
Crish’s System Architecture


Client Side:
Users interact with the system through a browser-based user interface, which includes customized modules such as Disease Overview, Weather Forecasts, and Health Facilities Visualization.
These modules are tailored to display data visualizations and actionable insights specific to the health decision support needs of Timor-Leste.
Backend:
The Superset Core API handles requests from the client, acting as the central hub for data retrieval, processing, and rendering.
The Data Access Layer bridges the API with the underlying data sources using database adapters to ensure seamless integration.
Customization Plugins extend the functionality of Superset, enabling the use of advanced visualizations (e.g., deck.gl with OpenStreetMap) and health-specific forecasting models.
Data Sources:
The system pulls data from multiple sources, including:
A PostgreSQL database for structured data like health records and facility information.
MongoDB for draft or frequently edited data, such as ongoing submissions.
A weather API (e.g., RIMES ECMWF) for real-time weather data integration.
Excel/CSV file uploads to incorporate manual data inputs, such as weekly disease case reports.
Authentication:
Keycloak is used as an identity provider, enabling secure, role-based access to the system’s features and data. Both client-side and backend authentication requests are routed through Keycloak.
Custom Plugins:
The deck.gl/OpenStreetMap integration enables advanced geospatial visualizations, crucial for mapping disease outbreaks and weather parameters.
Customized features handle health models and forecasting, processing real-time weather and disease data to provide actionable insights.
Validation mechanisms ensure that uploaded data aligns with predefined schemas.


Overview Module
			(Status: Done)

The Overview module is a feature designed to provide a comprehensive and quick snapshot of critical information relevant to health decision-making. It serves as a centralized dashboard, combining weather alerts, disease case trends, and geospatial weather data to empower healthcare professionals, policymakers, and decision-makers with actionable insights. It includes quick view of the following:

Weather Alerts for Health Decision Support:
Displays alerts such as heavy rainfall, heat caution, and extreme heat notifications.
Helps anticipate and mitigate weather-related health risks, such as heatstroke, dehydration, and flooding-related illnesses.

Disease Case Trends:
Provides real-time trends for diseases of interest, including dengue, diarrhea, and acute respiratory infections (ARI).
Enables users to monitor changes in case numbers, offering percentage comparisons to assess the severity of outbreaks or improvements.

Interactive Map with Weather Parameters:
Visualizes key weather parameters, including rainfall, temperature, heat index, and relative humidity.
Features health facility locations layered on the map for spatial analysis and enhanced planning.
Supports multi-layered data visualization, allowing users to customize the view according to their needs.





This module is designed to bridge the gap between health and environmental data, offering an integrated platform for proactive decision-making. It supports timely interventions, resource allocation, and crisis response planning.


Healthcare Facilities

(Status: Done)

This feature provides accessible, quality healthcare services to the community, ensuring health and wellness through various medical specialties and facilities. It is designed for patients, healthcare professionals, and the general public seeking medical care and information. Users can visualize all existing healthcare facilities in Timor-Leste, along with detailed information such as facility name, type (e.g., hospital, clinic), service offerings (e.g., emergency services, diagnostic services), specialty departments, operating hours, patient capacity, and hospital bed availability. This visualization aids users in identifying the most suitable healthcare facility for their needs and assists healthcare professionals in efficiently coordinating care, particularly during crises or disasters.




The development of this feature is complete, and real facility data is already being visualized. Users can view up-to-date information about healthcare facilities across Timor-Leste. Additionally, a submodule has been implemented that allows authorized users to update facility data as needed, ensuring the information remains accurate and relevant. This functionality is critical for maintaining the system’s reliability and usability in real-world scenarios.




Weather Forecast Module
(Status: Done, Needs Feedbcack from local MOH)

The Weather Forecast Module is a feature designed to deliver detailed and up-to-date insights into weather conditions across Timor-Leste, enabling informed decision-making and proactive responses to weather-related risks. At the heart of the module is an interactive heat index map that highlights regions experiencing extreme weather conditions. Warning icons, marked by exclamation points, appear on the map when the heat index category reaches “Extreme Heat Caution” (Level 4 or higher). These visual alerts are dynamically generated, drawing immediate attention to areas requiring prompt action. Users also have the flexibility to configure the thresholds for these warnings, tailoring the system to their operational or safety requirements.


Behind the scenes, the module continually pulls weather parameter data from dataex’s ECMWF system every day. This ensures that the information displayed is accurate, reliable, and up to date, providing users with real-time insights into critical parameters such as relative humidity, temperature, rainfall, and heat index.

To enhance its functionality, the module includes filters for forecast dates and municipalities. The forecast date filter allows users to focus on specific days, ensuring targeted planning and preparation for upcoming conditions. The municipality filter provides localized insights by narrowing the analysis to particular areas within Timor-Leste, making it a vital tool for community-level interventions. These features, combined with the real-time data pulling mechanism, provide a seamless and tailored weather monitoring experience.

Accompanying the map is a detailed forecast table that presents comprehensive weather data, including forecast dates, municipality names, relative humidity percentages, maximum temperatures, rainfall measurements, heat index values, and their corresponding categories. This table is fully searchable, allowing users to quickly locate specific information. By integrating this tabular view with the map, the module ensures that users have access to both granular data and a high-level geographical overview.

In addition to these features, the module includes line charts that visualize weather trends over time, such as changes in relative humidity, maximum temperature, and rainfall. These trend analyses offer a broader perspective, helping users identify patterns or anomalies in weather conditions. By combining real-time alerts, localized filters, and visualized trends, the module empowers decision-makers, health officials, and disaster response teams to act swiftly and effectively in mitigating weather-related risks. This system not only enhances preparedness but also supports the overall well-being and safety of communities throughout Timor-Leste.

The development of underlying technology for this feature is complete, but its layout and visualization may still be revised as needed based on the feedback received.


Diseases Module

			(Status: Done, Needs Localization)

The Diseases Overview Module is designed to visualize and manage weekly case reports for key diseases of public health concern, including diarrhea, dengue, and acute respiratory infections (ARI). The module offers up-to-date data and tools for health officials, policymakers, and decision-makers to monitor trends, identify hotspots, and allocate resources effectively to mitigate the impact of these diseases on the population.

At the center of the module is a summary of weekly case reports, prominently displaying the total number of cases for diarrhea, dengue, and ARI, which gives users a quick overview of the current epidemiological situation. The module also highlights the latest available epidemiological week, ensuring that users work with the most recent data. The geographic distribution of cases is visualized on an interactive map, where municipalities are color-coded to reflect case intensity. Users can toggle between different data layers to focus on weekly case data for diarrhea, dengue, or ARI. This interactive visualization makes it easy to identify areas requiring immediate intervention.
			

The module integrates a Filter Municipality feature that allows users to narrow their focus to specific areas within Timor-Leste. This granular filtering provides tailored insights that are particularly valuable for targeting specific communities. 



In addition to visualizing case data, the module includes a dedicated Update Disease Case Reports page, which allows users to input and upload new disease case data for specific weeks and municipalities. This ensures that the module remains dynamic and up-to-date. Users can select the municipality, input the year and week of the data being uploaded, and download a template that conforms to the required format for weekly surveillance reports. The template is compatible with both .xls and .xlsx file formats, streamlining the process for health officials to submit accurate and standardized data. Once the file is uploaded, it is integrated into the system, and the latest reports are reflected in the module.


Bulletins and Advisories 

(Status: Done, Needs Localization)

The Bulletins and Advisories allows users to create and disseminate important announcements, alerts, and updates. This page is designed to facilitate the publication of bulletins and advisories on various topics, such as weather warnings, disease outbreaks, or general public health information, ensuring that timely and relevant messages reach the intended audience.

Each bulletin includes a title, message, and optional hashtags to improve categorization and searchability. Users can also associate bulletins with specific charts to provide additional context or visualization of data related to the advisory. For example, a bulletin about heavy rainfall could link to a chart displaying recent rainfall trends.

The page features a streamlined layout that displays all bulletins in a card format, showing the title, a brief description, and relevant metadata, such as the date of posting and the user who created it. Each card also includes a thumbnail placeholder for charts or visuals associated with the bulletin. A set of filters is available at the top of the page, allowing users to search or sort bulletins by title, creator, hashtags, or creation date, enabling efficient navigation through the list of published items.


The creation of new bulletins is facilitated through a simple and interactive form. Users can input the bulletin’s title, message, and hashtags, and optionally select an associated chart from the charts library to enhance the bulletin’s informative value. Once submitted, the new bulletin is added to the list and becomes available for public viewing or distribution.





Alerts and Reports 

(Status: Done, Needs Localization)

The Alerts and Reports Module is a feature designed to streamline the creation, scheduling, and distribution of automated reports and alerts. This module supports information dissemination by enabling users to generate detailed reports or set up alerts for key data metrics, ensuring timely updates and actionable insights are delivered to relevant stakeholders.

At the core of this module is the ability to schedule reports based on dashboards or specific data visualizations within the system. Users can customize report content by selecting dashboards, applying filters, and specifying the report format, such as PNG or other visual representations. The scheduling feature allows users to define the frequency and timing of the reports, accommodating diverse operational needs, whether they require daily updates, weekly summaries, or real-time notifications. Timezone settings further enhance the flexibility of scheduling, making the feature adaptable for regional or global teams.

The interface provides a clear overview of all active and inactive reports, displaying key details such as the report name, owner, schedule, last run time, notification method, and modification history. Users can also enable or disable reports as needed, allowing dynamic management of reporting workflows. For seamless communication, the notification system supports email as a delivery method, ensuring that recipients receive the reports promptly and in an accessible format.



Creating a new report is intuitive, with a guided form that walks users through entering general information, selecting the report contents (dashboard and filters), defining the schedule, and setting up notification preferences. Users can also specify whether to ignore cache when generating reports, ensuring that the most up-to-date data is included. Once configured, these reports are sent to recipients automatically according to the defined schedule, reducing manual effort and improving efficiency.

The module also integrates alerts for specific metrics or data points, allowing users to stay informed about critical changes or thresholds. This ensures timely interventions and proactive decision-making in scenarios where real-time updates are crucial, such as monitoring disease outbreaks or weather-related risks.

An example of the output can be seen in email notifications, where recipients receive visual reports summarizing key metrics, charts, and insights. These reports enhance situational awareness and provide actionable insights in an easy-to-digest format.


Multilingual Support

			(Status: Done)

The DSS includes a multilingual support feature, allowing users to switch between English, Tetum, and Portuguese languages. This feature ensures accessibility and inclusivity, accommodating the linguistic diversity of Timor-Leste and its stakeholders. 

The language-switching functionality is integrated directly into the user interface, enabling users to toggle between their preferred language with ease. All key system components, including dashboards, modules, data labels, tooltips, notifications, and system messages, dynamically update to reflect the selected language. This ensures that users can interact with the system in their most comfortable language.

This multilingual capability was implemented with the help of internationalization (i18n) frameworks, which manage the translation of system content while maintaining consistent functionality across languages. Each language is supported by a robust translation file that ensures accurate and contextually appropriate terms are displayed.

Challenges

The development of CRISH faced several challenges stemming from delays in data collection, schema discrepancies, technical customization hurdles, and communication barriers, which required strategic resolutions to ensure progress and alignment with stakeholder needs.

One of the primary challenges was the delay in conducting the user needs assessment and validation, which was only completed in early May due to scheduling and timing constraints with stakeholders. This delay also affected the timeline for data assessment and collection, as the Climate and Health Technical Working Group (TWG) of Timor-Leste wanted to first review the system prototype to better understand the data requirements. The late availability of localized weather and specific health data further compounded the issue, as such data were essential for developing accurate health models and forecasting functionalities.

In the absence of real data, an assumed data schema was created, and dummy data were generated for use in the prototype. While this approach allowed for system prototyping to proceed, it posed significant risks. The schema and dummy data used in the prototype differed from the actual data practices and recording methods used by stakeholders on the ground. This misalignment led to challenges in adapting the system to real data once it became available. The structural differences necessitated reworking the schema and interface, resulting in additional development time and resource allocation.

The customization of Apache Superset for CRISH also presented technical challenges. Customizing Superset plugins, particularly for the geospatial visualization features and tailored reporting functionalities, required extensive configuration and management of npm packages. Issues in dependency management and integration arose, impacting the development workflow and extending the timeline for delivering customized features.

Another significant challenge was related to communication and feedback between the developer and stakeholders. Initially, there was insufficient feedback and collaboration, which led to delays in addressing critical concerns and adapting the system to user needs. This was exacerbated by changes in project management, which introduced a learning curve for adapting to new workflows and expectations. However, this issue was resolved by instituting weekly meetings with stakeholders. These regular discussions improved communication, facilitated timely feedback, and ensured that both the development team and stakeholders remained aligned throughout the process. 

Furthermore, the team lost the domain expertise of the epidemiologist. Together with the epidemiologist, the development team is working on the risk analysis for dengue. The risk matrix was already provided, however this was not translated into meaningful information once the epidemiologist left the team. No further guidance from a domain expert was provided, hence the risk for the analysis tools as well as the features being developed increased significantly.

The continuous data integration with the TLHIS team is yet to happen. This integration ensures that the case reports are updated via API, reducing the risk of uploading or manually inputting the weekly case reports.

The team strongly recommends having a dedicated domain expert, and although RIMES has experience in creating weather related DSS, the needs and thought processes of domain experts from experience and vast knowledge are irreplaceable.
