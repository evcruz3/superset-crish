# Progress Report: Disease Module

## Introduction

This deliverable focused on the development of a comprehensive Disease Module. The primary goal is to integrate disease case report data, visualize current and historical disease counts, and implement an AI-driven model for disease outbreak forecasting, projection, and alert generation. The module aims to provide robust tools for public health monitoring, analysis, and response, including advisory dissemination and identification of critical areas.

Key features will include:
*   Integration of health department case report data.
*   Visualization of current disease case counts at municipality level.
*   Tabular and chart views for historical disease counts at municipality level.
*   An AI model for disease outbreak forecasting (municipality level) with selectable time periods and diseases.
*   Generation of advisories based on outbreak severity for various administrative levels (MOH, Municipality, Health Center).
*   Identification and visualization (tabular/map) of disease hotspots and coldspots at the municipality level.
*   Functionality to add new advisories based on custom thresholds.
*   Access to informational materials regarding disease symptoms, prevention, and causes.

This module aims to enhance disease monitoring capabilities and provide valuable tools for accessing and understanding disease-related information.


## Activity Progress

| Activity                                                                 | Target                                                                                                                                                                                             | Progress              | Remarks                                                                                                                                                                                                                                                           |
| :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disease Case Data Integration**                                        | Integrate case report data provided from the health department for each disease.                                                                                                                   | Completed           | Disease case reports can be uploaded via the 'Update Case Reports' interface.                                                                      |
| **Current Disease Case Count Visualization**                             | Display current disease cases count by municipality level.                                                                                                                                         | Completed             | AI predictions are at municipality level. Frontend has tabs for "Forecasts" & "Table" to display this. Suko level was deemed out of scope due to data availability.                                                            |
| **Historical Disease Count Visualization**                               | Develop tabular and chart views for historical disease counts by municipality level.                                                                                                               | Completed             | Frontend "Trendlines" tab links to a 'Disease' dashboard for these views at municipality level. Suko level was deemed out of scope due to data availability.                                |
| **AI Model Development: Outbreak Forecast & Projection**                 | Implement an AI-based model for disease outbreak forecast/projection (Municipality Level), with time period and disease selection.                                                                 | Completed             | AI models (.h5) for Dengue & Diarrhea predict at **municipality level**. Time/disease selection is available via Superset charts. Suko-level AI forecasting was deemed not feasible with current data.                                                    |
| **AI Model Feature: Advisory Generation**                                | Generate advisories based on severity of disease outbreak for MOH, Municipality, and Health Center (Post Admin Level).                                                                               | Completed | Advisories generated for **municipalities** using hardcoded templates. These advisories can then be customized before dissemination.                |
| **AI Model Feature: Hotspot/Coldspot Identification**                    | Identify and visualize (tabular/map view) disease hotspots (locations most affected with total count) and coldspots (locations less affected) at municipality level.                                 | Completed | Map images show alert levels by municipality, visually indicating hotspots/coldspots. |
| **AI Model Feature: Custom Advisory & Information Material Management**    | Implement a function to add new advisories based on thresholds and integrate informational material (symptoms, prevention, cause).                                                                 | Completed | Thresholds & advisory content are generated with Advisory, Risks, and Safety Tips.                                                  | 